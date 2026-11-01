export class FieldGeometryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FieldGeometryError';
  }
}

export class FieldDistrictError extends Error {
  constructor(districtId) {
    super(`No district with id "${districtId}".`);
    this.name = 'FieldDistrictError';
    this.districtId = districtId;
  }
}
