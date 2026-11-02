export class FieldGeometryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FieldGeometryError';
  }

}

export class FieldSessionConflictError extends Error {
  constructor() {
    super('This anonymous session already has a registered field.');
    this.name = 'FieldSessionConflictError';
  }
}

export class FieldDistrictError extends Error {
  constructor(districtId) {
    super(`No district with id "${districtId}".`);
    this.name = 'FieldDistrictError';
    this.districtId = districtId;
  }
}
