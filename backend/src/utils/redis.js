// Mock redis since Docker/Redis not available locally
console.log('Using mock Redis locally');
export default {
  get: async () => null,
  set: async () => {},
  del: async () => {}
};
