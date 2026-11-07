import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSupportedOfficeExtension, getOfficeMimeType } from '../server/gotenberg-client.js';

test('isSupportedOfficeExtension identifies all supported office documents', () => {
  assert.equal(isSupportedOfficeExtension('document.docx'), true);
  assert.equal(isSupportedOfficeExtension('legacy.doc'), true);
  assert.equal(isSupportedOfficeExtension('slides.pptx'), true);
  assert.equal(isSupportedOfficeExtension('slides.ppt'), true);
  assert.equal(isSupportedOfficeExtension('spreadsheet.xlsx'), true);
  assert.equal(isSupportedOfficeExtension('sheet.xls'), true);
  assert.equal(isSupportedOfficeExtension('document.odt'), true);
  assert.equal(isSupportedOfficeExtension('document.rtf'), true);
  assert.equal(isSupportedOfficeExtension('text.txt'), true);

  assert.equal(isSupportedOfficeExtension('image.png'), false);
  assert.equal(isSupportedOfficeExtension('file.pdf'), false);
  assert.equal(isSupportedOfficeExtension('archive.zip'), false);
});

test('getOfficeMimeType maps extensions to correct standard MIME types', () => {
  assert.equal(
    getOfficeMimeType('test.docx'),
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  assert.equal(
    getOfficeMimeType('test.pptx'),
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  );
  assert.equal(
    getOfficeMimeType('test.xlsx'),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  assert.equal(getOfficeMimeType('test.pdf'), 'application/pdf');
});

import convertOfficeToPdfHandler from '../api/convert-office-to-pdf.js';

test('convertOfficeToPdfHandler returns 405 for non-POST method', async () => {
  let statusCode = 0;
  let jsonResponse: any = null;

  const req: any = {
    method: 'GET',
    headers: {},
    body: {},
  };
  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      jsonResponse = data;
      return this;
    },
  };

  await convertOfficeToPdfHandler(req, res);
  assert.equal(statusCode, 405);
  assert.match(jsonResponse.error, /POST/);
});

test('convertOfficeToPdfHandler returns 400 when missing fileBase64', async () => {
  let statusCode = 0;
  let jsonResponse: any = null;

  const req: any = {
    method: 'POST',
    headers: {},
    body: { fileName: 'test.docx' },
  };
  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      jsonResponse = data;
      return this;
    },
  };

  await convertOfficeToPdfHandler(req, res);
  assert.equal(statusCode, 400);
  assert.match(jsonResponse.error, /Thiếu dữ liệu tệp/);
});

test('convertOfficeToPdfHandler returns 400 for unsupported file extension', async () => {
  let statusCode = 0;
  let jsonResponse: any = null;

  const req: any = {
    method: 'POST',
    headers: {},
    body: {
      fileName: 'invalid.exe',
      fileBase64: Buffer.from('dummy').toString('base64'),
    },
  };
  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      jsonResponse = data;
      return this;
    },
  };

  await convertOfficeToPdfHandler(req, res);
  assert.equal(statusCode, 400);
  assert.match(jsonResponse.error, /không được hỗ trợ/);
});
