// ending-portal-r16.js
// ES module, no imports — THREE is passed in by the caller.
//
// quadMatrix(THREE, corners, z) builds a THREE.Matrix4 that, when assigned to
// a mesh's .matrix (with mesh.matrixAutoUpdate = false), maps the local unit
// PlaneGeometry(1,1) — whose corners are (-.5,+.5) TL, (+.5,+.5) TR,
// (+.5,-.5) BR, (-.5,-.5) BL — onto an arbitrary convex quadrilateral given
// in world XY at a constant world z, under an OrthographicCamera looking
// down -Z. The mapping is a true 2D projective homography (8 DOF), not an
// affine approximation, so the GPU's perspective-correct (1/w) interpolation
// produces straight, correctly-converging texture lines across the quad.
//
// Derivation
// ----------
// This is the classic "unit square -> convex quadrilateral" homography
// (Heckbert, "Fundamentals of Texture Mapping and Image Warping", 1989,
// Appendix). Given four target points p0,p1,p2,p3 corresponding to unit
// square corners (0,0), (1,0), (1,1), (0,1) respectively, the map
//   (u,v,1) -> (X,Y,W),  actual point = (X/W, Y/W)
// is given by a 3x3 matrix:
//   X = a11*u + a21*v + a31
//   Y = a12*u + a22*v + a32
//   W = a13*u + a23*v + a33
// with coefficients solved from the four correspondences (see below).
//
// Our local plane coordinates (xl,yl) run over [-.5,.5]^2, not [0,1]^2, so
// we substitute u = xl + .5, v = yl + .5. Because that substitution is
// affine, it only changes the constant terms of each row (a31, a32, a33),
// which is folded into the matrix's translation column below.
//
// Corner order: the caller supplies corners = [TL, TR, BR, BL] in world XY.
// The unit-square correspondence used internally is
//   (u,v) = (0,0) -> BL = corners[3]   = p0
//   (u,v) = (1,0) -> BR = corners[2]   = p1
//   (u,v) = (1,1) -> TR = corners[1]   = p2
//   (u,v) = (0,1) -> TL = corners[0]   = p3
// which is exactly the mapping that sends local plane corner (-.5,-.5) (BL)
// to corners[3], (+.5,-.5) (BR) to corners[2], (+.5,+.5) (TR) to corners[1],
// and (-.5,+.5) (TL) to corners[0] — i.e. the mesh's four corners land on
// the caller's four corners in the stated TL,TR,BR,BL order.
//
// Embedding into a 4x4 matrix
// ----------------------------
// All source points have local z = 0 (a PlaneGeometry lies in its own XY
// plane), so the matrix's 3rd column (which would multiply zl) is unused —
// set it to 0 everywhere except optionally the W row, which we also leave 0
// there since w must not depend on zl.
//
// World Z is required to be the constant `z` for every point on the plane
// (a flat plane at depth z), so Z = z * W (Z/W = z always, regardless of
// u,v). That means the Z row of the matrix is simply `z` times the W row.
//
// Using THREE.Matrix4.set(...), whose arguments are in ROW-MAJOR order
// (n11,n12,n13,n14, n21,n22,n23,n24, n31,n32,n33,n34, n41,n42,n43,n44) —
// note THREE converts this internally to its column-major `elements` array,
// so passing rows here is correct and avoids manual column-major index
// mistakes:
//
//   row0 (X): [a11, a21, 0, cX]
//   row1 (Y): [a12, a22, 0, cY]
//   row2 (Z): [z*a13, z*a23, 0, z*cW]
//   row3 (W): [a13, a23, 0, cW]
//
// where cX,cY,cW are the constant terms after folding in the u=xl+.5,
// v=yl+.5 substitution (see code comments below).
//
// This 4x4, applied to local (xl,yl,0,1), yields clip-ish (X,Y,Z,W) with
// W varying across the plane whenever the quad is non-affine (a13 or a23
// nonzero) — exactly the varying-W row that makes GPU texture interpolation
// perspective-correct.

/**
 * @param {object} THREE - the THREE.js module/namespace (needs Matrix4).
 * @param {[{x:number,y:number},{x:number,y:number},{x:number,y:number},{x:number,y:number}]} corners
 *   [topLeft, topRight, bottomRight, bottomLeft] world XY positions that the
 *   PlaneGeometry(1,1) corners (-.5,.5),(.5,.5),(.5,-.5),(-.5,-.5) must land on.
 * @param {number} [z=0] - constant world z for the whole plane.
 * @returns {THREE.Matrix4}
 */
export function quadMatrix(THREE, corners, z = 0) {
	const [tl, tr, br, bl] = corners;

	// Unit-square correspondence: p0=(0,0)->BL, p1=(1,0)->BR, p2=(1,1)->TR, p3=(0,1)->TL
	const p0 = bl, p1 = br, p2 = tr, p3 = tl;

	const dx1 = p1.x - p2.x, dy1 = p1.y - p2.y;
	const dx2 = p3.x - p2.x, dy2 = p3.y - p2.y;
	const dx3 = p0.x - p1.x + p2.x - p3.x;
	const dy3 = p0.y - p1.y + p2.y - p3.y;

	const denom = dx1 * dy2 - dx2 * dy1;

	let a13, a23;
	const EPS = 1e-12;
	if (Math.abs(denom) < EPS) {
		// Degenerate / affine (parallelogram) case: dx3,dy3 are (numerically)
		// zero here too, so the perspective terms vanish (limit is 0/0 -> 0).
		a13 = 0;
		a23 = 0;
	} else {
		a13 = (dx3 * dy2 - dx2 * dy3) / denom;
		a23 = (dx1 * dy3 - dx3 * dy1) / denom;
	}

	const a11 = p1.x - p0.x + a13 * p1.x;
	const a21 = p3.x - p0.x + a23 * p3.x;
	const a31 = p0.x;

	const a12 = p1.y - p0.y + a13 * p1.y;
	const a22 = p3.y - p0.y + a23 * p3.y;
	const a32 = p0.y;

	const a33 = 1;

	// Fold the u = xl + .5, v = yl + .5 substitution into the constant terms:
	// X = a11*(xl+.5) + a21*(yl+.5) + a31 = a11*xl + a21*yl + (a11*.5+a21*.5+a31)
	const cX = a11 * 0.5 + a21 * 0.5 + a31;
	const cY = a12 * 0.5 + a22 * 0.5 + a32;
	const cW = a13 * 0.5 + a23 * 0.5 + a33;

	const m = new THREE.Matrix4();
	m.set(
		a11,       a21,       0, cX,
		a12,       a22,       0, cY,
		z * a13,   z * a23,   0, z * cW,
		a13,       a23,       0, cW
	);
	return m;
}

/**
 * Linearly interpolate between two 4-corner arrays.
 * @param {Array<{x:number,y:number}>} a
 * @param {Array<{x:number,y:number}>} b
 * @param {number} t
 * @returns {Array<{x:number,y:number}>}
 */
export function lerpCorners(a, b, t) {
	return a.map((c, i) => ({
		x: c.x + (b[i].x - c.x) * t,
		y: c.y + (b[i].y - c.y) * t,
	}));
}
