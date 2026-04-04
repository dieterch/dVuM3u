import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true,
});

export class OpenWebifError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'OpenWebifError';
    this.cause = options.cause;
  }
}

export class OpenWebifClient {
  constructor(config) {
    this.baseUrl = `http://${config.vuIp}`;
    this.bouquetRef = config.bouquetRef;
    this.timeoutMs = config.requestTimeoutMs;
  }

  async fetchBouquetServices() {
    const url = `${this.baseUrl}/web/getservices?sRef=${encodeURIComponent(this.bouquetRef)}`;
    const payload = await this.#fetchXml(url);
    const services = toArray(payload?.e2servicelist?.e2service ?? payload?.e2service);

    return services
      .map((service) => {
        const serviceRef = readFirst(
          service?.e2servicereference,
          service?.e2servicereference?.['#text'],
        );
        const name = readFirst(
          service?.e2servicename,
          service?.e2servicename?.['#text'],
        );

        return {
          name: String(name || '').trim(),
          serviceRef: String(serviceRef || '').trim(),
        };
      })
      .filter((service) => service.name && service.serviceRef);
  }

  async fetchEpgForService(serviceRef) {
    const url = `${this.baseUrl}/web/epgservice?sRef=${encodeURIComponent(serviceRef)}`;
    const payload = await this.#fetchXml(url);
    const events = toArray(payload?.e2eventlist?.e2event ?? payload?.e2event);

    return events
      .map((event) => normalizeEvent(event))
      .filter((event) => event && Number.isFinite(event.begin) && Number.isFinite(event.duration));
  }

  async #fetchXml(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'application/xml,text/xml',
        },
      });

      if (!response.ok) {
        throw new OpenWebifError(`OpenWebif request failed with status ${response.status}`);
      }

      const text = await response.text();

      try {
        return parser.parse(text);
      } catch (error) {
        throw new OpenWebifError('Invalid XML received from OpenWebif', { cause: error });
      }
    } catch (error) {
      if (error instanceof OpenWebifError) {
        throw error;
      }

      if (error.name === 'AbortError') {
        throw new OpenWebifError(`OpenWebif request timed out after ${this.timeoutMs}ms`, {
          cause: error,
        });
      }

      throw new OpenWebifError(`OpenWebif request failed: ${error.message}`, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeEvent(event) {
  const begin = Number(readFirst(event?.e2eventstart, event?.begin));
  const duration = Number(readFirst(event?.e2eventduration, event?.duration));
  const title = readFirst(event?.e2eventtitle, event?.title, '');
  const description = readFirst(
    event?.e2eventdescriptionextended,
    event?.e2eventdescription,
    event?.description,
    '',
  );

  return {
    title: String(title).trim(),
    description: String(description).trim(),
    begin,
    duration,
  };
}

function readFirst(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function toArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}
