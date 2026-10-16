async page => {
  const errors = [];
  page.on('pageerror', err => errors.push('[PAGE_ERROR] ' + err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push('[CONSOLE_ERROR] ' + msg.text());
    }
  });

  const results = {
    workflow1_2d_curves_markers: false,
    workflow2_3d_solids_spatial: false,
    workflow3_quick_context_menu: false,
    workflow4_unified_exporters: false,
    workflow5_console_cleanliness: false,
    details: {}
  };

  // Thiết lập Viewport rộng rãi chuẩn Desktop
  await page.setViewportSize({ width: 1440, height: 900 });

  // Điều hướng đến ứng dụng nếu chưa ở đúng URL
  if (!page.url().includes('3000/ve-hinh')) {
    await page.goto('http://localhost:3000/ve-hinh/');
  }
  await page.waitForSelector('#canvas svg', { timeout: 10000 });
  await page.waitForTimeout(500);

  // =========================================================================
  // LUỒNG 1: 2D Curves & Markers (Arc, Sector, Ellipse, Drag, Markers)
  // =========================================================================
  console.log('--- LUỒNG 1: Bắt đầu kiểm thử 2D Curves & Markers ---');

  // Đảm bảo ở chế độ 2D geometry
  await page.locator('[data-mode="geometry"]').click();
  await page.waitForTimeout(300);

  // Bấm nút "Bảng vẽ trống" từ templates nếu có hình cũ để có canvas tinh khôi
  const hasTemplates = await page.locator('#open-templates').count();
  if (hasTemplates) {
    await page.locator('#open-templates').click();
    await page.waitForTimeout(300);
    await page.locator('#blank-template').click();
    await page.waitForTimeout(400);
  }

  const canvasBox = await page.locator('#canvas').boundingBox();
  if (!canvasBox) throw new Error('Không tìm thấy bounding box của #canvas');

  // 1.1 Dựng Cung tròn (Arc): Click tool Arc, sau đó click 3 điểm: tâm, đầu cung, cuối cung
  await page.locator('[data-tool="arc"]').click();
  await page.waitForTimeout(200);
  await page.locator('#canvas').click({ position: { x: 260, y: 220 } }); // Tâm A
  await page.locator('#canvas').click({ position: { x: 380, y: 220 } }); // Điểm B
  await page.locator('#canvas').click({ position: { x: 260, y: 120 } }); // Điểm C
  await page.waitForTimeout(300);

  // 1.2 Dựng Hình quạt tròn (Sector): Click tool Sector, click 3 điểm
  await page.locator('[data-tool="sector"]').click();
  await page.waitForTimeout(200);
  await page.locator('#canvas').click({ position: { x: 520, y: 220 } }); // Tâm D
  await page.locator('#canvas').click({ position: { x: 630, y: 220 } }); // Điểm E
  await page.locator('#canvas').click({ position: { x: 520, y: 130 } }); // Điểm F
  await page.waitForTimeout(300);

  // 1.3 Dựng Elip (Ellipse): Click tool Ellipse, click 3 điểm
  await page.locator('[data-tool="ellipse"]').click();
  await page.waitForTimeout(200);
  await page.locator('#canvas').click({ position: { x: 320, y: 440 } }); // Tâm G
  await page.locator('#canvas').click({ position: { x: 440, y: 440 } }); // Trục lớn H
  await page.locator('#canvas').click({ position: { x: 320, y: 380 } }); // Trục nhỏ I
  await page.waitForTimeout(300);

  // Kiểm tra 2D document schema đã ghi nhận đủ arc, sector, ellipse
  const doc2D = await page.evaluate(() => window.__veHinh.getDoc());
  const arcShape = doc2D.shapes.find(s => s.type === 'arc');
  const sectorShape = doc2D.shapes.find(s => s.type === 'sector');
  const ellipseShape = doc2D.shapes.find(s => s.type === 'ellipse');

  if (!arcShape || !sectorShape || !ellipseShape) {
    throw new Error(`Dựng 2D Curves thất bại: Arc=${!!arcShape}, Sector=${!!sectorShape}, Ellipse=${!!ellipseShape}`);
  }

  // 1.4 Kéo thả thử nghiệm điểm điều khiển
  await page.locator('[data-tool="select"]').click();
  await page.waitForTimeout(200);
  const firstPointEl = page.locator('#canvas [data-point]').first();
  const ptBox = await firstPointEl.boundingBox();
  const initCx = await firstPointEl.locator('circle').first().getAttribute('cx');

  await page.mouse.move(ptBox.x + ptBox.width / 2, ptBox.y + ptBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(ptBox.x + ptBox.width / 2 + 40, ptBox.y + ptBox.height / 2 + 25);
  await page.mouse.up();
  await page.waitForTimeout(300);

  const movedCx = await firstPointEl.locator('circle').first().getAttribute('cx');
  if (initCx === movedCx) {
    throw new Error('Kéo thả điểm điều khiển không làm thay đổi tọa độ!');
  }

  // 1.5 Dựng đoạn thẳng và thử nghiệm Marker đoạn 'triple'
  await page.locator('[data-tool="segment"]').click();
  await page.waitForTimeout(200);
  await page.locator('#canvas').click({ position: { x: 580, y: 440 } });
  await page.locator('#canvas').click({ position: { x: 720, y: 440 } });
  await page.waitForTimeout(300);

  // Chọn đoạn thẳng vừa tạo và gán marker = 'triple'
  await page.locator('[data-tool="select"]').click();
  await page.waitForTimeout(200);
  const segEl = page.locator('#canvas [data-shape]').last();
  await segEl.click({ force: true });
  await page.waitForTimeout(200);

  // Đổi marker qua sidebar properties
  await page.locator('#show-properties').click();
  await page.waitForTimeout(200);
  await page.locator('#shape-mark').selectOption('triple');
  await page.waitForTimeout(200);

  // 1.6 Thử nghiệm Góc vuông ('right') và Góc bằng nhau ('single', 'double')
  await page.locator('#shape-mark').selectOption('single');
  await page.waitForTimeout(150);
  await page.locator('#shape-mark').selectOption('double');
  await page.waitForTimeout(150);
  await page.locator('#shape-mark').selectOption('triple');
  await page.waitForTimeout(200);

  // Dựng góc vuông với tool rightAngle
  await page.locator('#show-tools').click();
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    document.querySelector('[data-tool="rightAngle"]')?.closest('details')?.setAttribute('open', '');
  });
  await page.waitForTimeout(200);
  await page.locator('[data-tool="rightAngle"]').click({ force: true });
  await page.waitForTimeout(200);
  await page.locator('#canvas').click({ position: { x: 800, y: 220 } });
  await page.locator('#canvas').click({ position: { x: 880, y: 220 } });
  await page.locator('#canvas').click({ position: { x: 880, y: 140 } });
  await page.waitForTimeout(300);

  // Chụp ảnh màn hình Luồng 1
  await page.screenshot({ path: 'scratch/e2e-2d-curves.png' });
  results.workflow1_2d_curves_markers = true;
  results.details.curves = { arc: arcShape.id, sector: sectorShape.id, ellipse: ellipseShape.id };
  console.log('✔ LUỒNG 1: Hoàn thành xuất sắc 2D Curves & Markers!');

  // =========================================================================
  // LUỒNG 2: 3D Solids & Spatial Tools (Cone, Cylinder, Sphere, Tetrahedron, Frustum, Planes, StyleMode)
  // =========================================================================
  console.log('--- LUỒNG 2: Bắt đầu kiểm thử 3D Solids & Spatial Tools ---');

  // Chuyển sang 3D mode
  await page.locator('[data-mode="solid"]').click();
  await page.waitForTimeout(400);
  await page.locator('#show-tools').click();
  await page.waitForTimeout(200);

  // 2.1 Đổi sang Hình nón (Cone)
  await page.locator('[data-primitive-3d="cone"]').click();
  await page.waitForTimeout(300);
  let curSolidType = await page.evaluate(() => window.__veHinh.getDoc().solid?.type);
  if (curSolidType !== 'cone') throw new Error(`Khối nón không áp dụng: type=${curSolidType}`);
  const coneGeneratorCount = await page.locator('#canvas [data-cone-generator]').count();
  if (coneGeneratorCount < 2) throw new Error('Hình nón thiếu đường sinh silhouette!');

  // 2.2 Đổi sang Hình trụ (Cylinder)
  await page.locator('[data-primitive-3d="cylinder"]').click();
  await page.waitForTimeout(300);
  curSolidType = await page.evaluate(() => window.__veHinh.getDoc().solid?.type);
  if (curSolidType !== 'cylinder') throw new Error(`Khối trụ không áp dụng: type=${curSolidType}`);

  // 2.3 Đổi sang Khối cầu (Sphere)
  await page.locator('[data-primitive-3d="sphere"]').click();
  await page.waitForTimeout(300);
  curSolidType = await page.evaluate(() => window.__veHinh.getDoc().solid?.type);
  if (curSolidType !== 'sphere') throw new Error(`Khối cầu không áp dụng: type=${curSolidType}`);
  const sphereCount = await page.locator('#canvas [data-sphere-contour], #canvas [data-sphere-silhouette]').count();
  if (!sphereCount) throw new Error('Khối cầu thiếu contour vòng bao!');

  // 2.4 Đổi sang Tứ diện đều (regular-tetrahedron)
  await page.locator('[data-primitive-3d="regular-tetrahedron"]').click();
  await page.waitForTimeout(300);
  curSolidType = await page.evaluate(() => window.__veHinh.getDoc().solid?.type);
  if (curSolidType !== 'regular-tetrahedron') throw new Error(`Tứ diện đều không áp dụng: type=${curSolidType}`);

  // 2.5 Đổi sang Chóp cụt tứ giác (frustum)
  await page.locator('[data-primitive-3d="frustum"]').click();
  await page.waitForTimeout(300);
  curSolidType = await page.evaluate(() => window.__veHinh.getDoc().solid?.type);
  if (curSolidType !== 'frustum') throw new Error(`Chóp cụt không áp dụng: type=${curSolidType}`);

  // 2.6 Dựng mặt phẳng 3D bán trong suốt (solid.planes) qua 3 đỉnh
  await page.locator('[data-tool="plane3d"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-vertex="A"]').click({ force: true });
  await page.waitForTimeout(200);
  await page.locator('[data-vertex="B"]').click({ force: true });
  await page.waitForTimeout(200);
  await page.locator('[data-vertex="C"]').click({ force: true });
  await page.waitForTimeout(300);

  const doc3D = await page.evaluate(() => window.__veHinh.getDoc());
  const createdPlane = (doc3D.solid?.planes || []).find(pl => 
    pl.refs.includes('A') && pl.refs.includes('B') && pl.refs.includes('C')
  );
  if (!createdPlane) {
    throw new Error('Dựng mặt phẳng 3D (solid.planes) qua 3 đỉnh A, B, C thất bại!');
  }
  const planePolygonCount = await page.locator('#canvas [data-plane]').count();
  if (!planePolygonCount) throw new Error('Không tìm thấy SVG polygon [data-plane] trên canvas 3D!');

  // 2.7 Thử nghiệm chuyển đổi styleMode (solid/dashed) trên cạnh 3D
  await page.locator('#show-tools').click();
  await page.waitForTimeout(200);
  await page.locator('[data-tool="select3d"]').click();
  await page.waitForTimeout(200);
  const targetSeg = page.locator('#canvas [data-segment-3d]').first();
  const targetSegId = await targetSeg.getAttribute('data-segment-3d');
  
  // Dblclick để toggle styleMode
  await targetSeg.dblclick({ force: true });
  await page.waitForTimeout(300);
  const segAfterToggle = await page.evaluate(id => {
    const s = window.__veHinh.getDoc().solid?.segments?.find(x => x.id === id);
    return s ? s.styleMode : null;
  }, targetSegId);
  if (!segAfterToggle || segAfterToggle === 'auto') {
    throw new Error(`Dblclick đổi styleMode thất bại: ${segAfterToggle}`);
  }

  // Chụp ảnh màn hình Luồng 2
  await page.screenshot({ path: 'scratch/e2e-3d-solids.png' });
  results.workflow2_3d_solids_spatial = true;
  results.details.solid = { finalType: curSolidType, plane: createdPlane.id, toggledSegment: targetSegId };
  console.log('✔ LUỒNG 2: Hoàn thành xuất sắc 3D Solids & Spatial Tools!');

  // =========================================================================
  // LUỒNG 3: Quick Context Menu (2D & 3D, Colors, Dash, Width, Label, Opacity, Delete, Undo/Redo)
  // =========================================================================
  console.log('--- LUỒNG 3: Bắt đầu kiểm thử Quick Context Menu ---');

  // 3.1 Kiểm tra Quick Context Menu với đỉnh 3D
  await page.locator('#show-tools').click();
  await page.waitForTimeout(200);
  await page.locator('[data-tool="select3d"]').click();
  await page.waitForTimeout(200);
  const vertexA = page.locator('#canvas [data-vertex="A"]');
  await vertexA.click({ force: true });
  await page.waitForTimeout(300);

  const menuEl = page.locator('#quick-context-menu');
  const isMenuVisible = await menuEl.isVisible();
  if (!isMenuVisible) throw new Error('Quick Context Menu không hiển thị khi chọn đỉnh 3D!');

  // Sửa nhãn đỉnh A thành "A_VIP" qua #qcm-label-input
  const labelInput = page.locator('#qcm-label-input');
  await labelInput.fill('A_VIP');
  await labelInput.press('Enter');
  await page.waitForTimeout(300);

  let updatedLabel = await page.evaluate(() => {
    const pt = window.__veHinh.getDoc().solid?.points?.find(p => p.id === 'A');
    return pt ? pt.label : null;
  });
  if (updatedLabel !== 'A_VIP') throw new Error(`Đổi nhãn đỉnh thất bại: ${updatedLabel}`);

  // Hoàn tác Undo
  await page.locator('#undo').click();
  await page.waitForTimeout(300);
  let undoneLabel = await page.evaluate(() => {
    const pt = window.__veHinh.getDoc().solid?.points?.find(p => p.id === 'A');
    return pt ? pt.label : null;
  });
  if (undoneLabel === 'A_VIP') throw new Error('Undo đổi nhãn đỉnh không có hiệu lực!');

  // Làm lại Redo
  await page.locator('#redo').click();
  await page.waitForTimeout(300);
  let redoneLabel = await page.evaluate(() => {
    const pt = window.__veHinh.getDoc().solid?.points?.find(p => p.id === 'A');
    return pt ? pt.label : null;
  });
  if (redoneLabel !== 'A_VIP') throw new Error('Redo đổi nhãn đỉnh thất bại!');

  // 3.2 Kiểm tra Quick Context Menu với Mặt phẳng 3D (Đổi độ mờ)
  const planeEl = page.locator('#canvas [data-plane]').first();
  const clickedPlaneId = await planeEl.getAttribute('data-plane');
  await planeEl.click({ force: true });
  await page.waitForTimeout(300);

  // Bấm nút độ mờ 60%
  const opacityBtn = page.locator('#quick-context-menu [data-opacity="0.6"]');
  if (await opacityBtn.count()) {
    await opacityBtn.click();
    await page.waitForTimeout(300);
    const planeOpacity = await page.evaluate(id => {
      const pl = window.__veHinh.getDoc().solid?.planes?.find(p => p.id === id);
      return pl ? pl.opacity : null;
    }, clickedPlaneId);
    if (Math.abs(planeOpacity - 0.6) > 0.05) {
      throw new Error(`Đổi độ mờ mặt phẳng thất bại: ${planeOpacity}`);
    }
  }

  // 3.3 Kiểm tra Quick Context Menu với Hình 2D (Màu sắc, Nét đứt, Độ dày, Xóa nhanh)
  await page.locator('[data-mode="geometry"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-tool="select"]').click();
  await page.waitForTimeout(200);

  // Chọn hình ellipse 2D
  const shape2DEl = page.locator('#canvas [data-shape]').first();
  const shape2DId = await shape2DEl.getAttribute('data-shape');
  await shape2DEl.click({ force: true });
  await page.waitForTimeout(300);

  if (!(await menuEl.isVisible())) {
    throw new Error('Quick Context Menu không hiển thị khi chọn shape 2D!');
  }

  // Đổi kiểu nét: Bấm nút nét đứt #qcm-btn-dash
  const dashBtn = page.locator('#qcm-btn-dash');
  await dashBtn.click();
  await page.waitForTimeout(300);
  let isDashed = await page.evaluate(id => {
    const s = window.__veHinh.getDoc().shapes.find(x => x.id === id);
    return s ? s.dashed : null;
  }, shape2DId);
  if (!isDashed) throw new Error('Đổi kiểu nét qua Context Menu thất bại!');

  // Đổi độ dày nét: Bấm nút nét đậm 4.0
  await page.locator('#quick-context-menu .qcm-btn-width[data-width="4.0"]').click();
  await page.waitForTimeout(300);
  let strokeWidth = await page.evaluate(id => {
    const s = window.__veHinh.getDoc().shapes.find(x => x.id === id);
    return s ? s.strokeWidth : null;
  }, shape2DId);
  if (strokeWidth !== 4.0) throw new Error(`Đổi độ dày nét thất bại: ${strokeWidth}`);

  // Đổi màu sắc: Click swatch màu thứ hai trong bảng màu
  const swatches = page.locator('#quick-context-menu .qcm-color-swatch');
  if (await swatches.count() >= 2) {
    const secondColor = await swatches.nth(1).getAttribute('data-color');
    await swatches.nth(1).click();
    await page.waitForTimeout(300);
    const colorAfter = await page.evaluate(id => {
      const s = window.__veHinh.getDoc().shapes.find(x => x.id === id);
      return s ? s.color : null;
    }, shape2DId);
    if (colorAfter !== secondColor) throw new Error(`Đổi màu sắc qua Context Menu thất bại: ${colorAfter} !== ${secondColor}`);
  }

  // Thử nghiệm nút Xóa nhanh (#qcm-btn-delete)
  const countBeforeDelete = await page.evaluate(() => window.__veHinh.getDoc().shapes.length);
  await page.locator('#qcm-btn-delete').click();
  await page.waitForTimeout(300);
  const countAfterDelete = await page.evaluate(() => window.__veHinh.getDoc().shapes.length);
  if (countAfterDelete >= countBeforeDelete) throw new Error('Nút xóa nhanh trên Context Menu không xóa đối tượng!');

  // Hoàn tác Undo nút xóa
  await page.locator('#undo').click();
  await page.waitForTimeout(300);
  const countAfterUndo = await page.evaluate(() => window.__veHinh.getDoc().shapes.length);
  if (countAfterUndo !== countBeforeDelete) throw new Error('Undo phục hồi đối tượng bị xóa thất bại!');

  // Chụp ảnh màn hình Luồng 3
  await page.screenshot({ path: 'scratch/e2e-context-menu.png' });
  results.workflow3_quick_context_menu = true;
  console.log('✔ LUỒNG 3: Hoàn thành xuất sắc Quick Context Menu!');

  // =========================================================================
  // LUỒNG 4: Unified Exporters (TikZ không có '#', SVG/PNG không dính watermark tiếng Việt đè hình)
  // =========================================================================
  console.log('--- LUỒNG 4: Bắt đầu kiểm thử Unified Exporters ---');

  // 4.1 Kiểm tra TikZ 2D
  await page.locator('#export').click();
  await page.waitForTimeout(300);
  await page.locator('#export-tikz').click();
  await page.waitForTimeout(400);

  const tikzCode2D = await page.evaluate(() => window.__veHinh.exportTikZ());
  if (!tikzCode2D.includes('\\begin{tikzpicture}') || !tikzCode2D.includes('\\end{tikzpicture}')) {
    throw new Error('Mã TikZ 2D không chứa môi trường tikzpicture hợp lệ!');
  }
  if (tikzCode2D.includes('#')) {
    throw new Error('Mã TikZ 2D vi phạm nghiêm trọng: chứa ký tự "#" làm gãy biên dịch LaTeX!');
  }

  // 4.2 Kiểm tra Xuất SVG 2D
  await page.locator('#export').click();
  await page.waitForTimeout(300);
  const svgDownloadPromise2D = page.waitForEvent('download');
  await page.locator('#export-svg').click();
  const svgDownload2D = await svgDownloadPromise2D;
  const svgFilename2D = svgDownload2D.suggestedFilename();
  if (!svgFilename2D.endsWith('.svg')) throw new Error(`Tên file SVG 2D không đúng: ${svgFilename2D}`);

  // 4.3 Kiểm tra Xuất PNG 2D
  await page.locator('#export').click();
  await page.waitForTimeout(300);
  const pngDownloadPromise2D = page.waitForEvent('download');
  await page.locator('#export-png').click();
  const pngDownload2D = await pngDownloadPromise2D;
  const pngFilename2D = pngDownload2D.suggestedFilename();
  if (!pngFilename2D.endsWith('.png')) throw new Error(`Tên file PNG 2D không đúng: ${pngFilename2D}`);

  // 4.4 Kiểm tra TikZ 3D và SVG 3D không dính watermark
  await page.locator('[data-mode="solid"]').click();
  await page.waitForTimeout(400);

  const tikzCode3D = await page.evaluate(() => window.__veHinh.exportTikZ());
  if (!tikzCode3D.includes('\\begin{tikzpicture}') || !tikzCode3D.includes('\\end{tikzpicture}')) {
    throw new Error('Mã TikZ 3D không chứa môi trường tikzpicture hợp lệ!');
  }
  if (tikzCode3D.includes('#')) {
    throw new Error('Mã TikZ 3D vi phạm nghiêm trọng: chứa ký tự "#" làm gãy biên dịch LaTeX!');
  }

  // Kiểm tra chuỗi SVG 3D xuất ra
  const svgCode3D = await page.evaluate(() => window.__veHinh.exportSVG());
  if (/<text x="30" y="40"[^>]*>[\s\S]*?<\/text>/.test(svgCode3D)) {
    throw new Error('SVG 3D vi phạm: dính watermark tiêu đề tiếng Việt tại toạ độ (30, 40) đè hình vẽ!');
  }

  // Bắt sự kiện tải SVG 3D
  await page.locator('#export').click();
  await page.waitForTimeout(300);
  const svgDownloadPromise3D = page.waitForEvent('download');
  await page.locator('#export-svg').click();
  const svgDownload3D = await svgDownloadPromise3D;
  const svgFilename3D = svgDownload3D.suggestedFilename();
  if (!svgFilename3D.endsWith('.svg')) throw new Error(`Tên file SVG 3D không đúng: ${svgFilename3D}`);

  // Chụp ảnh màn hình Luồng 4
  await page.screenshot({ path: 'scratch/e2e-exporters.png' });
  results.workflow4_unified_exporters = true;
  results.details.exports = {
    tikz2DLength: tikzCode2D.length,
    tikz3DLength: tikzCode3D.length,
    svg2DFilename: svgFilename2D,
    png2DFilename: pngFilename2D,
    svg3DFilename: svgFilename3D
  };
  console.log('✔ LUỒNG 4: Hoàn thành xuất sắc Unified Exporters!');

  // =========================================================================
  // LUỒNG 5: Console Cleanliness (0 Console Errors & 0 Page Errors)
  // =========================================================================
  console.log('--- LUỒNG 5: Kiểm tra tính sạch của Console & Exceptions ---');
  if (errors.length > 0) {
    throw new Error('Phát hiện lỗi console/page trong phiên kiểm thử:\n' + errors.join('\n'));
  }
  results.workflow5_console_cleanliness = true;
  console.log('✔ LUỒNG 5: Console hoàn toàn sạch sẽ, 0 lỗi, 0 exceptions!');

  // Giữ nguyên giao diện mở ở chế độ Vẽ Hình cho người dùng trực tiếp nghiệm thu
  console.log('===============================================================');
  console.log('🎉 TOÀN BỘ 5 LUỒNG KIỂM THỬ PLAYWRIGHT E2E ĐÃ VƯỢT QUA 100%!');
  console.log('RÀNG BUỘC SỐNG CÒN: GIỮ NGUYÊN PHIÊN TRÌNH DUYỆT ĐANG MỞ!');
  console.log('===============================================================');

  return results;
}
