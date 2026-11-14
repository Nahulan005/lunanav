// Retained contract-prototype mocks; not used by the Python FastAPI application.
import type {
  EphemerisProvider, EphemerisRequest, EphemerisResult, ImageryProvider, ImageryResult,
  Result, Site, TerrainProvider, TerrainRequest, TerrainResult,
  VisibilityAnalysisProvider, VisibilityRequest, VisibilityResult,
} from './providers'
import { ProviderError } from './providers'

function mock<T>(value: T): Result<T> {
  return {
    value,
    provenance: {
      mode: 'mock', sourceIds: [], datasetIds: [], algorithmVersion: 'placeholder-1',
      assumptions: ['Fixed illustrative fixture; no NASA source data used.'],
      limitations: ['No scientific calculations, geographic coverage, or operational suitability.'],
      validation: 'unvalidated',
    },
  }
}

export class MockTerrainProvider implements TerrainProvider {
  async getTerrain(_request: TerrainRequest): Promise<Result<TerrainResult>> {
    return mock({ elevationM: null, verticalDatum: 'undefined-mock', slopeDeg: null,
      slopeBaselineM: null, horizon: [], coverage: 'none' })
  }
}
export class MockImageryProvider implements ImageryProvider {
  async getImagery(_site: Site): Promise<Result<ImageryResult>> {
    return mock({ localAssetPath: null, footprintDescription: null, metadata: null })
  }
}
export class MockEphemerisProvider implements EphemerisProvider {
  async getGeometry(request: EphemerisRequest): Promise<Result<EphemerisResult>> {
    if (!Number.isFinite(Date.parse(request.startUtc)) || !Number.isFinite(Date.parse(request.endUtc)) ||
      Date.parse(request.endUtc) <= Date.parse(request.startUtc) ||
      !Number.isFinite(request.stepSeconds) || request.stepSeconds <= 0) {
      throw new ProviderError('INVALID_INPUT', 'A valid increasing time window and positive step are required.')
    }
    // Explicitly absent geometry avoids implying a calculated ephemeris.
    return mock({ samples: [], frame: request.site.lunarFrame, kernelIds: [], coverage: 'none' })
  }
}
export class MockVisibilityAnalysisProvider implements VisibilityAnalysisProvider {
  async analyze(request: VisibilityRequest): Promise<Result<VisibilityResult>> {
    return mock({
      samples: request.ephemeris.value.samples.map(({ utc }) => ({
        utc, sunlight: null, earthGeometricVisibility: null,
      })),
      radioCommunication: 'not-assessed',
    })
  }
}
