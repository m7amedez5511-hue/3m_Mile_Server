import { jest } from '@jest/globals';

// Pure util — no mocks required beyond a fake Express `res`.
const { sendResponse } = await import('../../utils/response.js');

const mockRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue('json-return');
  return res;
};

describe('Utils — sendResponse', () => {
  // 1. Success envelope: status set, success true, message and data forwarded
  it('should set the status and send a success envelope with data', () => {
    const res = mockRes();
    const data = { id: 1 };

    const returned = sendResponse(res, 200, 'ok', data);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true, message: 'ok', responseAt: expect.any(Date), data,
    });
    expect(returned).toBe('json-return');
  });

  // 2. data defaults to null when omitted
  it('should default data to null', () => {
    const res = mockRes();

    sendResponse(res, 201, 'created');

    expect(res.json.mock.calls[0][0]).toMatchObject({ success: true, message: 'created', data: null });
  });

  // 3. success is false for any status >= 400
  it('should set success:false when the status is 400 or above', () => {
    for (const status of [400, 401, 404, 422, 500]) {
      const res = mockRes();
      sendResponse(res, status, 'err');
      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json.mock.calls[0][0].success).toBe(false);
    }
  });

  // 4. success is true for every status below 400 (incl. 3xx)
  it('should set success:true for statuses below 400', () => {
    for (const status of [200, 204, 302, 399]) {
      const res = mockRes();
      sendResponse(res, status, 'fine');
      expect(res.json.mock.calls[0][0].success).toBe(true);
    }
  });

  // 5. responseAt is a fresh Date close to now
  it('should stamp responseAt with the current time', () => {
    const res = mockRes();
    const before = Date.now();

    sendResponse(res, 200, 'ok');

    const { responseAt } = res.json.mock.calls[0][0];
    expect(responseAt).toBeInstanceOf(Date);
    expect(responseAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(responseAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  // 6. Falsy-but-valid data (0, '', false, []) is passed through, not replaced by null
  it('should pass through falsy data values without defaulting them', () => {
    for (const data of [0, '', false, []]) {
      const res = mockRes();
      sendResponse(res, 200, 'ok', data);
      expect(res.json.mock.calls[0][0].data).toEqual(data);
    }
  });

  // 7. The envelope has exactly the four documented keys
  it('should only include success, message, responseAt and data', () => {
    const res = mockRes();

    sendResponse(res, 200, 'ok', { a: 1 });

    expect(Object.keys(res.json.mock.calls[0][0]).sort()).toEqual(['data', 'message', 'responseAt', 'success']);
  });
});
