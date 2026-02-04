export class SpotCache {
  constructor(limit = 1000) {
    this.limit = limit;
    this.cache = [];
  }

  add(spot) {
    this.cache.push(spot);
    if (this.cache.length > this.limit) {
      this.cache.shift();
    }
  }

  getAll() {
    return [...this.cache];
  }
}
