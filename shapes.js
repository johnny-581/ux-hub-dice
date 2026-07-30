// The frame source: your painted PNGs, advanced in file order.
//
// All five share one 1004×790 canvas and each shape sits in a different place
// within it, so the box in styles.css matches that aspect ratio and the image
// fills it whole. That keeps the art registered frame to frame — cropping these
// to their bounding boxes is exactly what would make the flipbook jitter.

const FRAME_DIR = 'animation-frames';

const SHAPES = [
  'Untitled_Artwork-1.png', // charcoal skewed square
  'Untitled_Artwork-2.png', // orchid circle
  'Untitled_Artwork-3.png', // blue triangle
  'Untitled_Artwork-4.png', // pale pink square
  'Untitled_Artwork-5.png', // terracotta X
];

function frameSrc(name) {
  return `${FRAME_DIR}/${encodeURIComponent(name)}`;
}

function renderShape(name) {
  if (!SHAPES.includes(name)) return '';
  return `<img class="ink" src="${frameSrc(name)}" alt="">`;
}

// Warm the cache before the first roll. The opening frames hold for 40ms each,
// which is not enough time to decode a 1004×790 PNG from cold.
function preloadShapes() {
  return SHAPES.map((name) => {
    const img = new Image();
    img.src = frameSrc(name);
    return img;
  });
}
