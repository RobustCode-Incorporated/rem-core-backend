// Tests sign and verify tokens with their own secret; production must set a real one.
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-0001';
