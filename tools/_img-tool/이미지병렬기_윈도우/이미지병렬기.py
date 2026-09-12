import concurrent.futures
import os
import shutil
import tempfile
import threading
import uuid
from io import StringIO
from pathlib import Path
from pptx import Presentation
from docx import Document
from pypdf import PdfReader

import customtkinter as ctk
from PIL import Image
from tkinter import filedialog, messagebox

try:
    from tkinterdnd2 import COPY, DND_FILES, TkinterDnD
except ImportError:
    COPY = DND_FILES = TkinterDnD = None

# 사용자님의 컴퓨터에 설치된 gti 엔진을 불러옵니다.
try:
    from gti.client import Client
except ImportError:
    messagebox.showerror("에러", "gti 라이브러리를 찾을 수 없습니다.")


# 같은 기획을 서로 다른 전체 디자인 언어로 해석하기 위한 방향입니다.
# 대상, 필수 요소, 스케일, 사용자가 지정한 시점은 유지하도록 공통 지시를 둡니다.
ART_DIRECTIONS = (
    "Refined minimalist direction: restrained palette, generous negative space, precise "
    "geometry, premium materials, and calm editorial lighting.",
    "Warm tactile direction: natural wood, soft textiles, handcrafted details, warm "
    "ambient light, and an inviting human-scale atmosphere.",
    "Futuristic laboratory direction: brushed metal, translucent surfaces, controlled "
    "cool lighting, clean modular systems, and precise technical detailing.",
    "Bold graphic direction: confident color blocking, large graphic moments, expressive "
    "contrast, playful surfaces, and a clear visual hierarchy.",
    "Quiet contemporary gallery direction: monochrome or near-monochrome tones, sculptural "
    "forms, sparse presentation, soft indirect lighting, and museum-like restraint.",
    "Biophilic direction: natural textures, greenery integrated into the design, daylight, "
    "earthy colors, and a calm connection to nature.",
    "Vintage editorial direction: considered patina, tactile paper-like or aged materials, "
    "muted color, nostalgic details, and artful layered composition.",
    "High-fashion luxury direction: rich material contrast, dramatic but controlled light, "
    "bespoke details, deep tonal color, and polished campaign-like styling.",
    "Playful pop direction: optimistic palette, rounded or unexpected forms, approachable "
    "details, energetic accents, and an immediately memorable identity.",
    "Industrial workshop direction: exposed structure, honest utilitarian materials, robust "
    "fixtures, functional details, and purposeful directional lighting.",
    "Soft pastel contemporary direction: light tonal colors, gentle translucent layers, "
    "rounded details, diffused light, and a delicate optimistic mood.",
    "Cinematic dramatic direction: deep shadows, focused pools of light, strong material "
    "texture, a limited palette, and an immersive narrative atmosphere.",
)
CONCEPT_BLUEPRINTS = (
    "Layout: disciplined asymmetric grid with generous quiet space; hierarchy: one small focal detail, not a dominant headline; palette: restrained neutral with one accent.",
    "Layout: intimate tactile layers and soft overlap; hierarchy: material and atmosphere first; palette: warm natural tones; avoid hard geometric poster structures.",
    "Layout: modular technical system with precise spacing; hierarchy: object/system first; palette: cool monochrome and translucent accents; avoid organic dot patterns.",
    "Layout: playful unexpected scale and off-centre balance; hierarchy: bold graphic shapes before text; palette: optimistic multi-colour; avoid red-black default treatment.",
    "Layout: sparse gallery composition with one sculptural intervention; hierarchy: silence and form; palette: near monochrome; avoid dense information blocks.",
    "Layout: nature-led spatial rhythm with organic edge conditions; hierarchy: greenery and daylight; palette: earth and mineral; avoid synthetic radial graphics.",
    "Layout: layered archival editorial composition; hierarchy: cropped details and tactile fragments; palette: faded ink; avoid contemporary campaign polish.",
    "Layout: premium fashion campaign with deliberate cropping and dramatic negative space; hierarchy: material and light; palette: deep rich tones; avoid generic infographic styling.",
    "Layout: cheerful pop system with playful modules; hierarchy: memorable shape language; palette: high-key contrasting colours; avoid monochrome seriousness.",
    "Layout: functional industrial arrangement; hierarchy: construction and utility; palette: steel, charcoal, concrete; avoid decorative gradients and soft organic motifs.",
    "Layout: airy soft contemporary composition; hierarchy: translucent layers and rounded forms; palette: pale tonal field; avoid hard black-red contrast.",
    "Layout: cinematic narrative scene with selective illumination; hierarchy: tension through shadow and depth; palette: limited dramatic tones; avoid flat poster-like frontal layout.",
)

ART_DIRECTION_GUARDRAIL = (
    "Keep the original subject, required elements, scale, and requested camera viewpoint "
    "consistent. Change the overall design language only; do not introduce unrelated subjects."
)
DIVERSITY_REQUIREMENT = (
    "This is a distinct concept direction, not a color variation of another result. "
    "Make the design language decisively different through palette, materials, lighting, "
    "surface treatment, typography/graphic language, furniture or display strategy, and mood. "
    "Avoid generic defaults and do not merely recolor the same solution."
)
MAX_PARALLEL_REQUESTS = 20
MAX_GENERATED_IMAGES = 50
MAX_REFERENCE_IMAGES = 10
MAX_MATERIAL_CHARS = 12000
MATERIAL_EXTENSIONS = {".docx", ".pptx", ".pdf"}
REFERENCE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
IMAGE_SIZE_OPTIONS = ["자동", "1024×1024", "1536×1024", "1024×1536", "2048×2048", "2048×1152", "3840×2160 (4K 가로)", "2160×3840 (4K 세로)"]
IMAGE_SIZE_VALUES = {"자동": "auto", "1024×1024": "1024x1024", "1536×1024": "1536x1024", "1024×1536": "1024x1536", "2048×2048": "2048x2048", "2048×1152": "2048x1152", "3840×2160 (4K 가로)": "3840x2160", "2160×3840 (4K 세로)": "2160x3840"}


def is_valid_image_count(value):
    """Return whether value is within the safe 1–20 image request range."""
    return 1 <= value <= MAX_GENERATED_IMAGES


def resolve_save_directory(selected_path, chooser):
    """Use a valid selected folder, otherwise fall back to the folder picker."""
    selected_path = selected_path.strip()
    if selected_path:
        return selected_path if os.path.isdir(selected_path) else None
    return chooser() or None


def make_engine_output_path():
    """Create a writable, unique temporary PNG destination for gti."""
    directory = Path(tempfile.gettempdir()) / "image_parallel_generator"
    directory.mkdir(parents=True, exist_ok=True)
    return str(directory / f"generated-{uuid.uuid4().hex}.png")


def valid_reference_paths(paths):
    return [path for path in paths[:MAX_REFERENCE_IMAGES] if os.path.isfile(path)]


def parse_drop_paths(data, splitlist):
    """Parse Finder drop data without breaking paths that contain spaces."""
    if not data:
        return []
    return [str(path) for path in splitlist(data)]


def merge_supported_paths(existing, incoming, extensions, limit=None):
    """Merge unique supported paths and return every rejected or over-limit path."""
    merged = list(existing)
    rejected = []
    for raw_path in incoming:
        path = str(raw_path)
        if Path(path).suffix.lower() not in extensions:
            rejected.append(path)
            continue
        if path in merged:
            continue
        if limit is not None and len(merged) >= limit:
            rejected.append(path)
            continue
        merged.append(path)
    return merged, rejected


def extract_material_text(paths):
    """Extract readable text from DOCX, PPTX, and text-based PDF files."""
    parts, errors = [], []
    for raw_path in paths:
        path = Path(raw_path)
        try:
            suffix = path.suffix.lower()
            if suffix == ".pdf":
                text = "\n".join(page.extract_text() or "" for page in PdfReader(str(path)).pages)
            elif suffix == ".docx":
                text = "\n".join(paragraph.text for paragraph in Document(str(path)).paragraphs)
            elif suffix == ".pptx":
                text = "\n".join(
                    shape.text for slide in Presentation(str(path)).slides
                    for shape in slide.shapes if hasattr(shape, "text") and shape.text.strip()
                )
            else:
                continue
            if text.strip():
                parts.append(f"[{path.name}]\n{text.strip()}")
            else:
                errors.append(f"{path.name}: 읽을 수 있는 텍스트가 없습니다")
        except Exception as error:
            errors.append(f"{path.name}: {error}")
    return "\n\n".join(parts)[:MAX_MATERIAL_CHARS], errors


def build_generation_prompt(base_prompt, index, multi_concept, manual_direction=""):
    """Return either the original brief or the brief with a whole-design direction."""
    if not multi_concept:
        return base_prompt

    direction = manual_direction.strip() or ART_DIRECTIONS[index % len(ART_DIRECTIONS)]
    return (
        f"{base_prompt}\n\n"
        f"[Mandatory distinct concept direction #{index + 1}]\n{direction}\n{CONCEPT_BLUEPRINTS[index % len(CONCEPT_BLUEPRINTS)]}\n\n"
        f"[Diversity requirement]\n{DIVERSITY_REQUIREMENT}\n\n"
        f"[Consistency requirements]\n{ART_DIRECTION_GUARDRAIL}"
    )


def compile_generation_prompt(user_brief, material_context, index, multi_concept, manual_direction=""):
    """Build the private model prompt; callers keep this implementation detail out of the UI."""
    source = "\n\n".join(part for part in (user_brief.strip(), material_context.strip()) if part)
    lowered = source.lower()
    rules = []
    if any(term in lowered for term in ("포스터", "키비주얼", "banner", "poster", "sns")):
        rules.append("Use one clear focal point, 2–4 hierarchy levels, and no more than three visual roles: background, structure, accent.")
    if any(term in lowered for term in ("브랜드", "로고", "identity", "campaign")):
        rules.append("Keep logos secondary, preserve a safe outer margin, and separate brand color roles from the hero content.")
    if any(term in lowered for term in ("공간", "팝업", "전시", "매장", "space")):
        rules.append("Define a believable visitor flow, material palette, lighting logic, and a clear primary spatial moment.")
    compiled = build_generation_prompt(source, index, multi_concept, manual_direction)
    if rules:
        compiled += "\n\n[Relevant design production rules]\n" + "\n".join(f"- {rule}" for rule in rules[:2])
    return compiled


def gallery_grid_position(index):
    """Return the fixed three-column gallery position for a result index."""
    return divmod(index, 3)


def gallery_status_text(result_count, completed=None, total=None):
    """Return a compact gallery count or active generation status."""
    if completed is not None and total:
        return f"{completed} / {total} 생성 중"
    return f"{result_count}개 결과"


COLORS = {
    "background": "#1a1917",
    "left_panel": "#141311",
    "surface": "#201e1a",
    "surface_high": "#282520",
    "surface_inset": "#171613",
    "accent": "#e0894a",
    "accent_hover": "#ee9a5c",
    "text": "#f2ede2",
    "text_secondary": "#b8b1a4",
    "text_muted": "#8b8578",
    "border": "#37332d",
    "border_soft": "#2d2a25",
    "success": "#829678",
    "warning": "#d49a62",
    "error": "#b9685c",
}

FONT_FAMILY = "Apple SD Gothic Neo"
PANEL_RADIUS = 14
CARD_RADIUS = 10
CONTROL_RADIUS = 8


# 디자인 테마 설정 (다크 모드)
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")


class ImageGeneratorUI(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("이미지 병렬기")
        self.geometry("1440x860")
        self.minsize(1180, 720)
        self.configure(fg_color=COLORS["background"])
        self.grid_columnconfigure(0, minsize=364, weight=0)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self.current_image_paths = []
        self.image_labels = []
        self.gallery_cards = []
        self.reference_paths = []
        self.material_paths = []
        self.material_context = ""
        self.run_id = 0
        self.active_stop_event = None
        self.active_total = 0
        self.active_completed = 0
        self.gallery_resize_after = None
        self.last_thumbnail_width = 0

        self.save_dir_var = ctk.StringVar(value="")
        self.style_mode_var = ctk.StringVar(value="자동")
        self.size_var = ctk.StringVar(value="자동")

        self.dnd_available = self._enable_drag_and_drop()
        self._build_left_panel()
        self._build_gallery_panel()
        self._update_manual_style_visibility()
        self._refresh_material_summary()
        self._refresh_reference_summary()
        self._show_empty_state()
        self._set_generation_state(False)

    @staticmethod
    def _font(size, weight="normal"):
        return ctk.CTkFont(family=FONT_FAMILY, size=size, weight=weight)

    def _secondary_button(self, parent, text, command, **kwargs):
        height = kwargs.pop("height", 32)
        return ctk.CTkButton(
            parent,
            text=text,
            command=command,
            height=height,
            corner_radius=CONTROL_RADIUS,
            fg_color=COLORS["surface_high"],
            hover_color="#332f29",
            text_color=COLORS["text"],
            border_width=1,
            border_color=COLORS["border"],
            font=self._font(12, "bold"),
            **kwargs,
        )

    def _ghost_button(self, parent, text, command, **kwargs):
        height = kwargs.pop("height", 32)
        return ctk.CTkButton(
            parent,
            text=text,
            command=command,
            height=height,
            corner_radius=CONTROL_RADIUS,
            fg_color="transparent",
            hover_color=COLORS["surface_high"],
            text_color=COLORS["text_secondary"],
            border_width=1,
            border_color=COLORS["border"],
            font=self._font(12, "bold"),
            **kwargs,
        )

    def _enable_drag_and_drop(self):
        if TkinterDnD is None:
            return False
        try:
            TkinterDnD.require(self)
            return True
        except Exception:
            return False

    def _section(self, parent, number, title):
        frame = ctk.CTkFrame(parent, fg_color="transparent", corner_radius=0)
        frame.pack(fill="x", pady=(0, 10))
        heading = ctk.CTkFrame(frame, fg_color="transparent")
        heading.pack(fill="x", pady=(0, 5))
        ctk.CTkLabel(
            heading,
            text=number,
            width=20,
            height=20,
            corner_radius=6,
            fg_color=COLORS["surface_high"],
            text_color=COLORS["accent"],
            font=self._font(10, "bold"),
        ).pack(side="left")
        ctk.CTkLabel(
            heading,
            text=title,
            text_color=COLORS["text"],
            font=self._font(13, "bold"),
        ).pack(side="left", padx=(6, 0))
        return frame

    def _control_label(self, parent, text):
        label = ctk.CTkLabel(
            parent,
            text=text,
            text_color=COLORS["text_muted"],
            font=self._font(10, "bold"),
        )
        label.pack(anchor="w", pady=(0, 3))
        return label

    def _file_drop_zone(self, parent, title, detail, count_text, command):
        zone = ctk.CTkFrame(
            parent,
            height=52,
            corner_radius=CONTROL_RADIUS,
            fg_color=COLORS["surface_inset"],
            border_width=1,
            border_color=COLORS["border"],
        )
        zone.grid_propagate(False)
        zone.grid_columnconfigure(0, weight=1)

        copy = ctk.CTkFrame(zone, fg_color="transparent")
        copy.grid(row=0, column=0, sticky="ew", padx=(10, 6), pady=7)
        title_label = ctk.CTkLabel(
            copy,
            text=title,
            height=17,
            anchor="w",
            text_color=COLORS["text_secondary"],
            font=self._font(11, "bold"),
        )
        title_label.pack(fill="x")
        detail_label = ctk.CTkLabel(
            copy,
            text=detail,
            height=15,
            anchor="w",
            text_color=COLORS["text_muted"],
            font=self._font(9),
        )
        detail_label.pack(fill="x")
        count_label = ctk.CTkLabel(
            zone,
            text=count_text,
            width=42,
            text_color=COLORS["text_secondary"],
            font=self._font(10, "bold"),
        )
        count_label.grid(row=0, column=1, padx=(0, 6))
        button = self._ghost_button(zone, "선택", command, width=52)
        button.grid(row=0, column=2, padx=(0, 8))
        return zone, detail_label, count_label

    @staticmethod
    def _drop_zone_widgets(widget):
        yield widget
        for child in widget.winfo_children():
            yield from ImageGeneratorUI._drop_zone_widgets(child)

    def _register_drop_zone(self, zone, handler):
        if not self.dnd_available:
            return

        def activate(_event):
            zone.configure(border_color=COLORS["accent"], border_width=2)
            return COPY

        def deactivate(_event):
            zone.configure(border_color=COLORS["border"], border_width=1)
            return COPY

        def receive(event):
            deactivate(event)
            handler(event)
            return COPY

        for widget in self._drop_zone_widgets(zone):
            try:
                widget.drop_target_register(DND_FILES)
                widget.dnd_bind("<<DropEnter>>", activate)
                widget.dnd_bind("<<DropLeave>>", deactivate)
                widget.dnd_bind("<<Drop>>", receive)
            except Exception:
                continue

    def _build_left_panel(self):
        panel = ctk.CTkFrame(
            self,
            width=364,
            corner_radius=PANEL_RADIUS,
            fg_color=COLORS["left_panel"],
            border_width=1,
            border_color=COLORS["border_soft"],
        )
        panel.grid(row=0, column=0, sticky="nsew", padx=(12, 6), pady=12)
        panel.grid_propagate(False)
        panel.grid_columnconfigure(0, weight=1)
        panel.grid_rowconfigure(1, weight=1)
        self.left_panel = panel

        header = ctk.CTkFrame(panel, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", padx=16, pady=(12, 8))
        ctk.CTkLabel(
            header,
            text="이미지 병렬기",
            text_color=COLORS["text"],
            font=self._font(19, "bold"),
        ).pack(anchor="w")
        ctk.CTkLabel(
            header,
            text="AI 이미지 생성 작업대",
            text_color=COLORS["text_muted"],
            font=self._font(10),
        ).pack(anchor="w")

        controls = ctk.CTkFrame(
            panel,
            fg_color="transparent",
            corner_radius=0,
        )
        controls.grid(row=1, column=0, sticky="nsew", padx=16, pady=(0, 2))
        self.controls_frame = controls

        input_section = self._section(controls, "1", "작업 입력")
        self.input_section = input_section
        self._control_label(input_section, "프롬프트")
        self.prompt_entry = ctk.CTkTextbox(
            input_section,
            height=64,
            corner_radius=CONTROL_RADIUS,
            fg_color=COLORS["surface_inset"],
            border_width=1,
            border_color=COLORS["border"],
            text_color=COLORS["text"],
            font=self._font(13),
            wrap="word",
        )
        self.prompt_entry.pack(fill="x")
        (
            self.material_drop_zone,
            self.material_label,
            self.material_count_label,
        ) = self._file_drop_zone(
            input_section,
            "자료 파일을 여기에 놓기",
            "DOCX · PPTX · PDF",
            "0개",
            self.import_materials,
        )
        self.material_drop_zone.pack(fill="x", pady=(6, 0))
        self._register_drop_zone(self.material_drop_zone, self._handle_material_drop)

        style_section = self._section(controls, "2", "스타일")
        self.style_section = style_section
        self.style_mode_menu = ctk.CTkSegmentedButton(
            style_section,
            values=["자동", "수동", "끔"],
            variable=self.style_mode_var,
            command=self._update_manual_style_visibility,
            height=32,
            corner_radius=CONTROL_RADIUS,
            fg_color=COLORS["surface_inset"],
            selected_color=COLORS["accent"],
            selected_hover_color=COLORS["accent_hover"],
            unselected_color=COLORS["surface_inset"],
            unselected_hover_color=COLORS["surface_high"],
            text_color=COLORS["text"],
            font=self._font(11, "bold"),
        )
        self.style_mode_menu.pack(fill="x")
        self.manual_style_wrap = ctk.CTkFrame(style_section, fg_color="transparent")
        self.manual_style_wrap.pack(fill="x", pady=(8, 0))
        self._control_label(self.manual_style_wrap, "수동 스타일 키워드")
        self.manual_style_entry = ctk.CTkEntry(
            self.manual_style_wrap,
            height=36,
            corner_radius=CONTROL_RADIUS,
            fg_color=COLORS["surface_inset"],
            border_color=COLORS["border"],
            text_color=COLORS["text"],
            placeholder_text="예: 따뜻한 우드, 간결한 조명",
            placeholder_text_color=COLORS["text_muted"],
            font=self._font(12),
        )
        self.manual_style_entry.pack(fill="x")

        reference_section = self._section(controls, "3", "참고 자료")
        self.reference_section = reference_section
        (
            self.reference_drop_zone,
            self.reference_label,
            self.reference_count_label,
        ) = self._file_drop_zone(
            reference_section,
            "이미지를 여기에 놓기",
            "PNG · JPG · WEBP",
            "0 / 10",
            self.choose_reference_images,
        )
        self.reference_drop_zone.pack(fill="x")
        self._register_drop_zone(self.reference_drop_zone, self._handle_reference_drop)

        output_section = self._section(controls, "4", "출력 설정")
        self.output_section = output_section
        setting_row = ctk.CTkFrame(output_section, fg_color="transparent")
        setting_row.pack(fill="x")
        count_group = ctk.CTkFrame(setting_row, fg_color="transparent")
        count_group.pack(side="left", fill="x")
        self._control_label(count_group, "생성 수")
        self.count_entry = ctk.CTkEntry(
            count_group,
            width=76,
            height=36,
            justify="center",
            corner_radius=CONTROL_RADIUS,
            fg_color=COLORS["surface_inset"],
            border_color=COLORS["border"],
            text_color=COLORS["text"],
            font=self._font(12, "bold"),
        )
        self.count_entry.insert(0, "10")
        self.count_entry.pack()
        size_group = ctk.CTkFrame(setting_row, fg_color="transparent")
        size_group.pack(side="left", expand=True, fill="x", padx=(8, 0))
        self._control_label(size_group, "비율 · 해상도")
        self.size_menu = ctk.CTkOptionMenu(
            size_group,
            values=IMAGE_SIZE_OPTIONS,
            variable=self.size_var,
            height=36,
            corner_radius=CONTROL_RADIUS,
            fg_color=COLORS["surface_inset"],
            button_color=COLORS["surface_high"],
            button_hover_color=COLORS["border"],
            dropdown_fg_color=COLORS["surface_high"],
            dropdown_hover_color=COLORS["border"],
            text_color=COLORS["text"],
            font=self._font(11),
            dropdown_font=self._font(11),
        )
        self.size_menu.pack(fill="x")

        self._control_label(output_section, "저장 폴더").pack_configure(pady=(7, 3))
        save_row = ctk.CTkFrame(output_section, fg_color="transparent")
        save_row.pack(fill="x")
        self.save_path_entry = ctk.CTkEntry(
            save_row,
            textvariable=self.save_dir_var,
            placeholder_text="저장할 폴더를 선택하세요",
            placeholder_text_color=COLORS["text_muted"],
            height=36,
            corner_radius=CONTROL_RADIUS,
            fg_color=COLORS["surface_inset"],
            border_color=COLORS["border"],
            text_color=COLORS["text"],
            font=self._font(11),
        )
        self.save_path_entry.pack(side="left", expand=True, fill="x")
        self._ghost_button(
            save_row, "선택", self.choose_save_directory, width=64
        ).pack(side="left", padx=(6, 0))

        footer = ctk.CTkFrame(
            panel,
            fg_color=COLORS["surface"],
            corner_radius=12,
            border_width=1,
            border_color=COLORS["border_soft"],
        )
        footer.grid(row=2, column=0, sticky="ew", padx=12, pady=(0, 10))
        self.footer_frame = footer

        status_row = ctk.CTkFrame(footer, fg_color="transparent")
        status_row.pack(fill="x", padx=12, pady=(8, 6))
        self.status_dot = ctk.CTkLabel(
            status_row,
            text="●",
            width=12,
            text_color=COLORS["text_muted"],
            font=self._font(9),
        )
        self.status_dot.pack(side="left")
        self.status_label = ctk.CTkLabel(
            status_row,
            text="대기 중",
            text_color=COLORS["text_muted"],
            font=self._font(11),
            anchor="w",
        )
        self.status_label.pack(side="left", expand=True, fill="x", padx=(4, 0))

        self.generate_btn = ctk.CTkButton(
            footer,
            text="생성 시작",
            height=48,
            corner_radius=CONTROL_RADIUS,
            fg_color=COLORS["accent"],
            hover_color=COLORS["accent_hover"],
            text_color=COLORS["background"],
            font=self._font(14, "bold"),
            command=self.generate_image,
        )
        self.generate_btn.pack(fill="x", padx=12)

        self.secondary_action_row = ctk.CTkFrame(footer, fg_color="transparent")
        self.secondary_action_row.pack(fill="x", padx=12, pady=(6, 10))
        self.stop_btn = ctk.CTkButton(
            self.secondary_action_row,
            text="생성 중단",
            height=40,
            corner_radius=CONTROL_RADIUS,
            fg_color=COLORS["surface_high"],
            hover_color="#342c27",
            text_color=COLORS["warning"],
            border_width=1,
            border_color="#5c4537",
            font=self._font(12, "bold"),
            command=self.cancel_generation,
        )
        self.input_clear_btn = self._ghost_button(
            self.secondary_action_row,
            "입력 초기화",
            self.clear_workspace,
            height=40,
        )
        self.input_clear_btn.pack(fill="x")

    def _build_gallery_panel(self):
        results = ctk.CTkFrame(
            self,
            corner_radius=PANEL_RADIUS,
            fg_color=COLORS["surface"],
            border_width=1,
            border_color=COLORS["border_soft"],
        )
        results.grid(row=0, column=1, sticky="nsew", padx=(6, 12), pady=12)
        results.grid_columnconfigure(0, weight=1)
        results.grid_rowconfigure(1, weight=1)
        self.results_panel = results

        header = ctk.CTkFrame(results, height=68, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", padx=20, pady=(16, 12))
        header.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(
            header,
            text="결과 갤러리",
            text_color=COLORS["text"],
            font=self._font(20, "bold"),
        ).grid(row=0, column=0, sticky="w")
        self.gallery_count_label = ctk.CTkLabel(
            header,
            text="0개 결과",
            height=28,
            corner_radius=7,
            fg_color=COLORS["surface_high"],
            text_color=COLORS["text_secondary"],
            font=self._font(11, "bold"),
        )
        self.gallery_count_label.grid(row=0, column=1, sticky="w", padx=(12, 0))
        self.save_btn = self._secondary_button(
            header, "전체 저장", self.save_all_images, width=92
        )
        self.save_btn.grid(row=0, column=2, padx=(8, 0))
        self.clear_btn = self._ghost_button(
            header, "갤러리 초기화", self.clear_gallery, width=116
        )
        self.clear_btn.grid(row=0, column=3, padx=(8, 0))

        self.gallery_frame = ctk.CTkScrollableFrame(
            results,
            fg_color=COLORS["background"],
            corner_radius=CARD_RADIUS,
            scrollbar_button_color=COLORS["surface_high"],
            scrollbar_button_hover_color=COLORS["border"],
        )
        self.gallery_frame.grid(row=1, column=0, sticky="nsew", padx=12, pady=(0, 12))
        for column in range(3):
            self.gallery_frame.grid_columnconfigure(column, weight=1, uniform="gallery")
        self.gallery_frame.bind("<Configure>", self._schedule_gallery_resize, add="+")
        self.gallery_frame.bind_all("<MouseWheel>", self._on_gallery_mousewheel, add="+")

        self.empty_state = ctk.CTkFrame(
            self.gallery_frame,
            height=520,
            fg_color="transparent",
            corner_radius=0,
        )
        self.empty_state.grid_propagate(False)
        self.empty_state.grid_columnconfigure(0, weight=1)
        self.empty_state.grid_rowconfigure(0, weight=1)
        empty_copy = ctk.CTkFrame(self.empty_state, fg_color="transparent")
        empty_copy.grid(row=0, column=0)
        ctk.CTkLabel(
            empty_copy,
            text="생성 결과가 여기에 표시됩니다",
            text_color=COLORS["text_secondary"],
            font=self._font(16, "bold"),
        ).pack()
        ctk.CTkLabel(
            empty_copy,
            text="왼쪽에서 작업을 설정하고 생성 시작을 눌러주세요.",
            text_color=COLORS["text_muted"],
            font=self._font(11),
        ).pack(pady=(6, 0))

    def _set_status(self, text, tone="muted"):
        tone_colors = {
            "muted": COLORS["text_muted"],
            "accent": COLORS["accent"],
            "success": COLORS["success"],
            "warning": COLORS["warning"],
            "error": COLORS["error"],
        }
        color = tone_colors.get(tone, COLORS["text_muted"])
        self.status_dot.configure(text_color=color)
        self.status_label.configure(text=text, text_color=color)

    def _set_generation_state(self, running):
        self.generate_btn.configure(state="disabled" if running else "normal")
        self.stop_btn.pack_forget()
        self.input_clear_btn.pack_forget()
        if running:
            self.stop_btn.pack(side="left", expand=True, fill="x", padx=(0, 3))
            self.input_clear_btn.pack(side="left", expand=True, fill="x", padx=(3, 0))
        else:
            self.input_clear_btn.pack(fill="x")

    def _update_manual_style_visibility(self, _value=None):
        if self.style_mode_var.get() == "수동":
            if not self.manual_style_wrap.winfo_ismapped():
                self.manual_style_wrap.pack(fill="x", pady=(8, 0))
        else:
            self.manual_style_wrap.pack_forget()

    def _refresh_material_summary(self):
        count = len(self.material_paths)
        self.material_count_label.configure(text=f"{count}개")
        if not self.material_paths:
            self.material_label.configure(
                text="DOCX · PPTX · PDF",
                text_color=COLORS["text_muted"],
            )
            return
        names = [Path(path).name for path in self.material_paths]
        first = names[0] if len(names[0]) <= 24 else f"{names[0][:21]}…"
        shown = first
        if len(names) > 1:
            shown += f" 외 {len(names) - 1}개"
        self.material_label.configure(text=f"반영됨 · {shown}", text_color=COLORS["success"])

    def _refresh_reference_summary(self):
        count = len(self.reference_paths)
        self.reference_count_label.configure(text=f"{count} / {MAX_REFERENCE_IMAGES}")
        if not self.reference_paths:
            self.reference_label.configure(
                text="선택한 이미지가 없습니다.",
                text_color=COLORS["text_muted"],
            )
            return
        names = [Path(path).name for path in self.reference_paths]
        first = names[0] if len(names[0]) <= 24 else f"{names[0][:21]}…"
        shown = first
        if len(names) > 1:
            shown += f" 외 {len(names) - 1}장"
        self.reference_label.configure(text=shown, text_color=COLORS["text_secondary"])

    def _refresh_gallery_header(self, completed=None, total=None):
        self.gallery_count_label.configure(
            text=gallery_status_text(
                len(self.current_image_paths), completed=completed, total=total
            ),
            text_color=COLORS["accent"] if total else COLORS["text_secondary"],
        )
        has_results = bool(self.current_image_paths)
        state = "normal" if has_results else "disabled"
        self.save_btn.configure(state=state)
        self.clear_btn.configure(state=state)

    def _show_empty_state(self):
        if not self.empty_state.winfo_ismapped():
            self.empty_state.grid(
                row=0,
                column=0,
                columnspan=3,
                sticky="nsew",
                padx=8,
                pady=8,
            )

    def _hide_empty_state(self):
        if self.empty_state.winfo_ismapped():
            self.empty_state.grid_remove()

    def _gallery_thumbnail_bounds(self):
        available = max(self.gallery_frame.winfo_width(), 720)
        width = max(180, min(340, (available - 64) // 3))
        height = max(176, min(300, int(width * 0.82)))
        return width, height

    @staticmethod
    def _thumbnail(path, width, height):
        with Image.open(path) as source:
            image = source.copy()
        image.thumbnail((width, height), Image.Resampling.LANCZOS)
        return image

    def _schedule_gallery_resize(self, event):
        expected_width = max(180, min(340, (max(event.width, 720) - 64) // 3))
        if abs(expected_width - self.last_thumbnail_width) < 16:
            return
        if self.gallery_resize_after is not None:
            self.after_cancel(self.gallery_resize_after)
        self.gallery_resize_after = self.after(120, self._resize_gallery_cards)

    def _resize_gallery_cards(self):
        self.gallery_resize_after = None
        width, height = self._gallery_thumbnail_bounds()
        self.last_thumbnail_width = width
        for item in self.gallery_cards:
            try:
                image = self._thumbnail(item["path"], width - 24, height - 20)
            except OSError:
                continue
            display_image = ctk.CTkImage(
                light_image=image,
                dark_image=image,
                size=image.size,
            )
            item["image"] = display_image
            item["label"].configure(image=display_image)
            item["image_frame"].configure(height=height)

    def _apply_material_paths(self, paths, replace=False, show_warnings=False):
        incoming = [str(path) for path in paths if os.path.isfile(path)]
        missing = [str(path) for path in paths if not os.path.isfile(path)]
        existing = [] if replace else list(self.material_paths)
        merged, rejected = merge_supported_paths(
            existing,
            incoming,
            MATERIAL_EXTENSIONS,
        )
        rejected.extend(missing)
        if not merged:
            self._set_status("DOCX · PPTX · PDF 파일만 넣을 수 있습니다.", "error")
            return 0

        text, errors = extract_material_text(merged)
        if not text:
            self._set_status("자료에서 읽을 수 있는 텍스트를 찾지 못했습니다.", "warning")
            if show_warnings and errors:
                messagebox.showwarning("자료 반영 제한", "\n".join(errors[:3]))
            return 0

        previous = set(self.material_paths)
        self.material_context = text
        self.material_paths = merged
        self._refresh_material_summary()
        added = len([path for path in merged if path not in previous])
        if rejected or errors:
            self._set_status(
                f"자료 {len(merged)}개 반영 · {len(rejected) + len(errors)}개 건너뜀",
                "warning",
            )
        else:
            self._set_status(f"자료 {len(merged)}개를 반영했습니다.", "success")
        if show_warnings and errors:
            messagebox.showwarning("일부 자료 제한", "\n".join(errors[:3]))
        return added

    def _handle_material_drop(self, event):
        paths = parse_drop_paths(event.data, self.tk.splitlist)
        self._apply_material_paths(paths, replace=False, show_warnings=False)
        return COPY

    def import_materials(self):
        paths = filedialog.askopenfilenames(
            title="자료 선택", filetypes=[("지원 자료", "*.docx *.pptx *.pdf")]
        )
        if paths:
            self._apply_material_paths(paths, replace=True, show_warnings=True)

    def generate_image(self):
        prompt = self.prompt_entry.get("1.0", "end").strip()
        if not prompt and not self.material_context:
            messagebox.showwarning("알림", "프롬프트를 입력해주세요!")
            return

        try:
            count = int(self.count_entry.get())
            if not is_valid_image_count(count):
                raise ValueError
        except ValueError:
            messagebox.showwarning(
                "알림", f"이미지 수는 1~{MAX_GENERATED_IMAGES}개로 입력해주세요!"
            )
            return

        style_mode = self.style_mode_var.get()
        multi_concept = style_mode != "끔"
        manual_direction = self.manual_style_entry.get().strip() if style_mode == "수동" else ""
        if style_mode == "수동" and not manual_direction:
            messagebox.showwarning("알림", "수동 스타일 키워드를 입력해주세요!")
            return
        reference_paths = list(self.reference_paths)
        image_size = IMAGE_SIZE_VALUES[self.size_var.get()]
        self.run_id += 1
        run_id = self.run_id
        stop_event = threading.Event()
        self.active_stop_event = stop_event

        self.active_total = count
        self.active_completed = 0
        self._set_status(f"{count}개 이미지를 생성하고 있습니다.", "accent")
        self._set_generation_state(True)
        self._refresh_gallery_header(completed=0, total=count)

        threading.Thread(
            target=self._run_parallel_generation,
            args=(prompt, self.material_context, count, multi_concept, manual_direction, reference_paths, image_size, run_id, stop_event),
            daemon=True,
        ).start()

    def cancel_generation(self):
        """Stop accepting results for the current run and restore the UI immediately."""
        if self.active_stop_event is None or self.active_stop_event.is_set():
            return

        self.active_stop_event.set()
        self.run_id += 1  # Late callbacks from the cancelled run are ignored.
        self.active_stop_event = None
        self._set_status("생성을 중단했습니다. 표시된 결과는 유지됩니다.", "warning")
        self._set_generation_state(False)
        self._refresh_gallery_header()

    def _run_parallel_generation(self, prompt, material_context, count, multi_concept, manual_direction, reference_paths, image_size, run_id, stop_event):
        success_count = 0
        error_msg = ""

        # 입력한 숫자(count)만큼 스레드를 100% 동시에 출발시킵니다.
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=min(count, MAX_PARALLEL_REQUESTS)
        ) as executor:
            futures = [
                executor.submit(
                    self._generate_single,
                    compile_generation_prompt(prompt, material_context, index, multi_concept, manual_direction),
                    reference_paths,
                    image_size,
                )
                for index in range(count)
            ]

            for future in concurrent.futures.as_completed(futures):
                path, err = future.result()
                if stop_event.is_set():
                    continue
                if path:
                    success_count += 1
                    self.after(0, self.accept_generated_result, run_id, stop_event, path,
                               success_count, count)
                if err and not error_msg:
                    error_msg = err

        if not stop_event.is_set():
            self.after(0, self.finish_generation, run_id, stop_event, success_count, count,
                       error_msg)

    def accept_generated_result(self, run_id, stop_event, path, completed, total):
        """Apply a worker result only when it belongs to the current live run."""
        if run_id != self.run_id or stop_event.is_set():
            return

        self.current_image_paths.append(path)
        self.add_image_to_gallery(path)
        self.active_completed = completed
        self._set_status(f"생성 중 · {completed} / {total} 완료", "accent")
        self._refresh_gallery_header(completed=completed, total=total)

    def _generate_single(self, prompt, reference_paths, image_size):
        try:
            client = Client()
            result = client.generate_image(
                prompt=prompt, output_path=make_engine_output_path(), image_paths=reference_paths or None, size=image_size
            )
            if result.saved_path and os.path.exists(result.saved_path):
                return result.saved_path, None
            return None, "저장된 경로를 찾을 수 없습니다."
        except Exception as error:
            return None, str(error)

    def add_image_to_gallery(self, path):
        self._hide_empty_state()
        width, height = self._gallery_thumbnail_bounds()
        image = self._thumbnail(path, width - 24, height - 20)
        display_image = ctk.CTkImage(
            light_image=image,
            dark_image=image,
            size=image.size,
        )
        card = ctk.CTkFrame(
            self.gallery_frame,
            fg_color=COLORS["surface_high"],
            corner_radius=CARD_RADIUS,
            border_width=1,
            border_color=COLORS["border_soft"],
        )
        card.grid_columnconfigure(0, weight=1)
        card_header = ctk.CTkFrame(card, fg_color="transparent")
        card_header.grid(row=0, column=0, sticky="ew", padx=12, pady=(10, 8))
        ctk.CTkLabel(
            card_header,
            text=f"결과 {len(self.image_labels) + 1:02d}",
            text_color=COLORS["text_secondary"],
            font=self._font(11, "bold"),
        ).pack(side="left")
        ctk.CTkLabel(
            card_header,
            text="원본 비율",
            text_color=COLORS["text_muted"],
            font=self._font(9),
        ).pack(side="right")

        image_frame = ctk.CTkFrame(
            card,
            height=height,
            fg_color=COLORS["surface_inset"],
            corner_radius=8,
        )
        image_frame.grid(row=1, column=0, sticky="ew", padx=8)
        image_frame.grid_propagate(False)
        label = ctk.CTkLabel(
            image_frame,
            image=display_image,
            text="",
            cursor="hand2",
        )
        label.place(relx=0.5, rely=0.5, anchor="center")
        label.bind(
            "<Button-1>",
            lambda _event, image_path=path: self.show_image_preview(image_path),
        )
        actions = ctk.CTkFrame(card, fg_color="transparent")
        actions.grid(row=2, column=0, sticky="ew", padx=8, pady=8)
        actions.grid_columnconfigure(0, weight=1)
        actions.grid_columnconfigure(1, weight=1)
        self._secondary_button(
            actions,
            "저장",
            lambda image_path=path: self.save_single_image(image_path),
        ).grid(row=0, column=0, sticky="ew", padx=(0, 4))
        self._ghost_button(
            actions,
            "레퍼런스로",
            lambda image_path=path: self.add_generated_reference(image_path),
        ).grid(row=0, column=1, sticky="ew", padx=(4, 0))

        idx = len(self.image_labels)
        row, col = gallery_grid_position(idx)
        card.grid(row=row, column=col, sticky="new", padx=6, pady=6)
        self.image_labels.append(card)
        self.gallery_cards.append(
            {
                "path": path,
                "card": card,
                "image_frame": image_frame,
                "label": label,
                "image": display_image,
            }
        )
        self.last_thumbnail_width = width
        self._refresh_gallery_header()

    def _on_gallery_mousewheel(self, event):
        if event.delta:
            step = -1 if event.delta > 0 else 1
            self.gallery_frame._parent_canvas.yview_scroll(step, "units")

    def show_image_preview(self, path):
        preview = ctk.CTkToplevel(self)
        preview.title("이미지 크게 보기")
        preview.geometry("1040x820")
        preview.minsize(720, 560)
        preview.configure(fg_color=COLORS["background"])
        preview.transient(self)
        header = ctk.CTkFrame(preview, height=52, fg_color=COLORS["surface"])
        header.pack(fill="x")
        ctk.CTkLabel(
            header,
            text="이미지 크게 보기",
            text_color=COLORS["text"],
            font=self._font(14, "bold"),
        ).pack(side="left", padx=20, pady=14)
        with Image.open(path) as source:
            image = source.copy()
        image.thumbnail((980, 720), Image.Resampling.LANCZOS)
        preview_image = ctk.CTkImage(
            light_image=image,
            dark_image=image,
            size=image.size,
        )
        label = ctk.CTkLabel(
            preview,
            image=preview_image,
            text="",
            fg_color=COLORS["surface_inset"],
        )
        label.image = preview_image
        label.pack(expand=True, fill="both", padx=16, pady=16)

    def save_single_image(self, path):
        save_dir = resolve_save_directory(
            self.save_dir_var.get(),
            lambda: filedialog.askdirectory(title="이미지를 저장할 폴더를 선택하세요"),
        )
        if not save_dir:
            return
        try:
            destination = os.path.join(save_dir, os.path.basename(path))
            shutil.copy2(path, destination)
            messagebox.showinfo("저장 완료", f"이미지를 저장했습니다.\n{destination}")
        except OSError as error:
            messagebox.showerror("저장 실패", str(error))

    def add_generated_reference(self, path):
        if path in self.reference_paths:
            messagebox.showinfo("레퍼런스", "이미 추가된 이미지입니다.")
            return
        if len(self.reference_paths) >= MAX_REFERENCE_IMAGES:
            messagebox.showwarning("레퍼런스 제한", "레퍼런스는 최대 10장까지 선택할 수 있습니다.")
            return
        self.reference_paths.append(path)
        self._refresh_reference_summary()
        self._set_status("결과 이미지를 레퍼런스에 추가했습니다.", "success")
        messagebox.showinfo("레퍼런스 추가", "다음 생성부터 이 이미지를 레퍼런스로 사용합니다.")

    def finish_generation(self, run_id, stop_event, success, total, error_msg):
        if run_id != self.run_id or stop_event.is_set():
            return

        self.active_stop_event = None
        self._set_generation_state(False)
        if success > 0:
            self._set_status(f"{success} / {total}개 생성 완료", "success")
            self._refresh_gallery_header()
        else:
            self.show_error(error_msg or "이미지를 하나도 생성하지 못했습니다.")

    def show_error(self, error_msg):
        self._set_generation_state(False)
        self._set_status("생성 중 오류가 발생했습니다.", "error")
        self._refresh_gallery_header()
        messagebox.showerror("생성 실패", f"에러 상세 원인:\n\n{error_msg}")

    def choose_save_directory(self):
        selected = filedialog.askdirectory(title="기본 저장 폴더를 선택하세요")
        if selected:
            self.save_dir_var.set(selected)

    def clear_workspace(self):
        if self.active_stop_event is not None:
            self.cancel_generation()
        self.prompt_entry.delete("1.0", "end")
        self.manual_style_entry.delete(0, "end")
        self.style_mode_var.set("자동")
        self._update_manual_style_visibility()
        self.reference_paths.clear()
        self.material_context = ""
        self.material_paths.clear()
        self.save_dir_var.set("")
        self._refresh_material_summary()
        self._refresh_reference_summary()
        self._set_status("입력 설정을 초기화했습니다.", "muted")

    def clear_gallery(self):
        for item in self.gallery_cards:
            item["card"].destroy()
        self.current_image_paths.clear()
        self.image_labels.clear()
        self.gallery_cards.clear()
        self._show_empty_state()
        self._refresh_gallery_header()
        self._set_status("갤러리 결과를 초기화했습니다.", "muted")

    def _apply_reference_paths(self, paths, replace=False, show_warnings=False):
        incoming = [str(path) for path in paths if os.path.isfile(path)]
        missing = [str(path) for path in paths if not os.path.isfile(path)]
        existing = [] if replace else list(self.reference_paths)
        previous = set(self.reference_paths)
        merged, rejected = merge_supported_paths(
            existing,
            incoming,
            REFERENCE_EXTENSIONS,
            limit=MAX_REFERENCE_IMAGES,
        )
        rejected.extend(missing)
        self.reference_paths = merged
        self._refresh_reference_summary()

        added = len([path for path in merged if path not in previous])
        if not merged:
            self._set_status("PNG · JPG · JPEG · WEBP 이미지만 넣을 수 있습니다.", "error")
        elif rejected:
            self._set_status(
                f"레퍼런스 {len(merged)}장 반영 · {len(rejected)}장 건너뜀",
                "warning",
            )
        elif added:
            self._set_status(f"레퍼런스 {len(merged)}장을 반영했습니다.", "success")
        else:
            self._set_status("이미 선택된 레퍼런스입니다.", "muted")

        if show_warnings and rejected:
            messagebox.showinfo(
                "레퍼런스 제한",
                "지원 형식이 아니거나 10장 제한을 넘은 항목은 제외했습니다.",
            )
        return added

    def _handle_reference_drop(self, event):
        paths = parse_drop_paths(event.data, self.tk.splitlist)
        self._apply_reference_paths(paths, replace=False, show_warnings=False)
        return COPY

    def choose_reference_images(self):
        selected = filedialog.askopenfilenames(
            title="레퍼런스 이미지 선택 (최대 10장)",
            filetypes=[("이미지 파일", "*.png *.jpg *.jpeg *.webp"), ("모든 파일", "*.*")],
        )
        if selected:
            self._apply_reference_paths(
                selected,
                replace=True,
                show_warnings=True,
            )

    def save_all_images(self):
        if not self.current_image_paths:
            return

        save_dir = resolve_save_directory(
            self.save_dir_var.get(),
            lambda: filedialog.askdirectory(title="이미지들을 저장할 폴더를 선택하세요"),
        )
        if not save_dir:
            if self.save_dir_var.get().strip():
                messagebox.showerror("저장 실패", "입력한 저장 폴더를 찾을 수 없습니다.")
            return

        saved_count = 0
        errors = []
        for i, path in enumerate(self.current_image_paths):
            try:
                ext = os.path.splitext(path)[1]
                new_path = os.path.join(save_dir, f"AI_생성_이미지_{i + 1}{ext}")
                shutil.copy2(path, new_path)
                saved_count += 1
            except OSError as error:
                errors.append(str(error))

        if errors:
            messagebox.showwarning(
                "일부 저장 실패", f"{saved_count}개 저장, {len(errors)}개 실패했습니다."
            )
        else:
            messagebox.showinfo("저장 완료", f"{saved_count}개의 이미지가 성공적으로 저장되었습니다!")


if __name__ == "__main__":
    app = ImageGeneratorUI()
    app.mainloop()
