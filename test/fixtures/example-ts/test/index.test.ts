import { app } from '@eggjs/mock/bootstrap';

describe('test/index.test.ts', () => {
  it('should work', async () => {
    await app.httpRequest()
      .get('/')
      .expect('hi, egg')
      .expect(200);
  });
});
