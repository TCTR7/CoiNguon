export const testPassword = 'local-test-12345';
export const fakeEmail = (prefix = 'user', domain = 'gia-dinh.test') =>
  prefix + '-' + crypto.randomUUID() + '@' + domain;
