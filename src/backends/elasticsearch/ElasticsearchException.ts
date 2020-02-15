export class ElasticsearchException implements Error {
  constructor(name: string, s: string) {
    this.name = name
    this.message = s
  }

  message: string
  name: string
}