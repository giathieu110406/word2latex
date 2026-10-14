# E2E Test Infra: Word2LaTeX 3D Geometry

## Test Philosophy
- **Opaque-box & Requirement-driven**: Thiết kế kiểm thử độc lập từ yêu cầu người dùng (`ORIGINAL_REQUEST.md`), không phụ thuộc vào thiết kế nội bộ.
- **Phương pháp luận**: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.
- **Nguyên tắc tiến triển (Progressive Testability)**: Cơ chế kiểm chứng của test không đòi hỏi tính năng phức tạp hơn tính năng đang được kiểm thử.

## Feature Inventory & Test Mapping
| # | Feature | Source (Requirement) | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Real-world) |
|---|---------|---------------------|:----------------:|:-----------------:|:-----------------:|:-------------------:|
| 1 | 3D Point Schema & Validation | R1, Acceptance | 5 | 5 | ✓ | ✓ |
| 2 | 3D Dependent Points (Midpoint, Ratio, Foot) | R1, R2, Acceptance | 5 | 5 | ✓ | ✓ |
| 3 | 3D Segment Model & Occlusion Modes | R1, Acceptance | 5 | 5 | ✓ | ✓ |
| 4 | 3D Planes & Cross-sections | R1, R2 | 5 | 5 | ✓ | ✓ |
| 5 | Undo/Redo History Stack | Acceptance | 5 | 5 | ✓ | ✓ |
| 6 | 3D Projection Engine | R3, Acceptance | 5 | 5 | ✓ | ✓ |
| 7 | Occlusion Engine (Backface/Raycast) | R3, Acceptance | 5 | 5 | ✓ | ✓ |
| 8 | Manual Override (Auto/Solid/Dashed) | R3, Acceptance | 5 | 5 | ✓ | ✓ |
| 9 | Smart Label Placement | R3 | 5 | 5 | ✓ | ✓ |
| 10 | 3D TikZ LaTeX Exporter | R4, Acceptance | 5 | 5 | ✓ | ✓ |
| 11 | SVG & PNG High-Res Export | Acceptance | 5 | 5 | ✓ | ✓ |
| 12 | AI 3D Prompting & Parsing | R5, Acceptance | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Runner**: Node.js Native Test Runner (`node --import tsx --test tests/*.test.ts`).
- **Linter**: `npm run lint` (`tsc --noEmit`).
- **Build**: `npm run build` (Vite + esbuild).
- **Test Suite Files**:
  - `tests/ve-hinh-3d-model.test.ts`: Tier 1 & 2 tests cho 3D Schema, vector math, điểm phụ thuộc và undo/redo.
  - `tests/ve-hinh-3d-projection.test.ts`: Tier 2 & 3 tests cho ma trận xoay, phép chiếu và occlusion engine.
  - `tests/ve-hinh-3d-tikz.test.ts`: Tier 3 tests cho TikZ exporter, ký hiệu góc vuông và SVG/PNG.
  - `tests/ve-hinh-3d-ai.test.ts`: Tier 4 tests cho Gemini AI backend, benchmark bài toán mẫu.
  - `tests/ve-hinh-3d-e2e.test.ts`: Tier 4 & 5 comprehensive integration & adversarial testing.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Chóp $S.ABCD$ có đáy vuông, $SA \perp đáy$, $M$ trung điểm $SC$, nối $AM$ | F1, F2, F3, F6, F7, F8, F10, F12 | Cao (Benchmark chính) |
| 2 | Chóp tam giác đều $S.ABC$ có $SO \perp (ABC)$, $I$ trung điểm $SA$ | F1, F2, F3, F6, F7, F10 | Trung bình |
| 3 | Hình lăng trụ đứng tam giác $ABC.A'B'C'$ có đáy vuông | F1, F3, F6, F7, F10 | Trung bình |
| 4 | Hình hộp / Lập phương $ABCD.A'B'C'D'$ cắt thiết diện qua $(AB'D')$ | F1, F3, F4, F6, F7, F10 | Cao |
| 5 | Xử lý lỗi & hoàn quota khi nhập đề bài vô nghĩa | F12 | Trung bình |

## Coverage Thresholds
- **Tier 1**: $\ge 5$ ca kiểm thử trên mỗi feature chính (tổng cộng $\ge 40$ test cases).
- **Tier 2**: $\ge 5$ ca kiểm thử biên (tọa độ cực trị, điểm trùng, $t \notin [0,1]$, chu trình phụ thuộc).
- **Tier 3**: Ma trận Pairwise xoay 360 độ kết hợp chế độ nét và manual override.
- **Tier 4**: $\ge 5$ kịch bản hình học THPT thực tế hoàn chỉnh.
- **Tổng mục tiêu**: Đảm bảo 100% tests PASS, giữ nguyên 68/68 test 2D cũ và thêm toàn bộ test 3D mới.
