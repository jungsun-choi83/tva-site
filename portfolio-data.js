export const portfolioStudies = [
  { id: 'visual-study-01', title: 'Identity Lock 01', category: 'Identity', year: 2026, image: '01.jpg', crop: '50% 42%' },
  { id: 'visual-study-02', title: 'Identity Lock 02', category: 'Identity', year: 2026, image: '02.jpg', crop: '42% 50%' },
  { id: 'visual-study-03', title: 'Soul Trace Letter', category: 'Archive', year: 2026, image: '03.jpg', crop: '58% 45%' },
  { id: 'visual-study-04', title: 'Hologram Study 01', category: 'Hologram', year: 2026, image: '04.jpg', crop: '48% 38%' },
  { id: 'visual-study-05', title: 'Hologram Study 02', category: 'Hologram', year: 2026, image: '05.jpg', crop: '55% 53%' },
  { id: 'visual-study-06', title: 'Device Cube', category: 'Device', year: 2026, image: '06.jpg', crop: '43% 46%' },
  { id: 'visual-study-07', title: 'NFC Memory Card', category: 'Archive', year: 2026, image: '07.jpg', crop: '62% 50%' },
  { id: 'visual-study-08', title: 'Life Archive', category: 'Device', year: 2026, image: '08.jpg', crop: '50% 58%' },
];

export const portfolioCategories = ['All', ...new Set(portfolioStudies.map((study) => study.category))];
