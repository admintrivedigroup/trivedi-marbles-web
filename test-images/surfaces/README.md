# Surface Detection Benchmark — Test Images

Place reference room photos here for repeatable benchmarking.

## Recommended test set

| Filename | Scene | Why it's useful |
|---|---|---|
| hallway.jpg | Corridor / hallway | Long narrow floor, clear left+right walls |
| living-room.jpg | Living room | Floor with furniture occlusion |
| kitchen.jpg | Kitchen | Countertops, floor, cabinets |
| bathroom.jpg | Bathroom | Tiles, fixtures, ceiling |
| staircase.jpg | Staircase | Stair treads, riser, railing |
| bedroom.jpg | Bedroom | Floor partially covered by rug/bed |
| office.jpg | Office / showroom | Large open floor plan |
| outdoor-entrance.jpg | Outdoor entrance | Transition zone — mixed surfaces |
| marble-polished.jpg | Polished marble floor | High-reflectivity surface |
| marble-dark.jpg | Dark marble floor | Low-contrast segmentation challenge |

## Usage

1. Add images to this folder
2. Open `/debug/surface-benchmark`
3. Upload each image and run the benchmark
4. Record results in the comparison table

## Evaluation criteria

- Floor detection accuracy (does the mask cover the visible floor cleanly?)
- Wall separation (are walls distinct from floor and each other?)
- Furniture preservation (is furniture excluded from floor/wall masks?)
- Staircase detection (are stair treads and risers labelled correctly?)
- Inference speed (how long does each model take on a warm/cold start?)
- Class count (how many semantic labels does each model return?)
