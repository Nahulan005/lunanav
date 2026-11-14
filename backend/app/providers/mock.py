"""Fixed illustrative fixtures. No LOLA, SPICE, terrain, or orbital calculations."""
from datetime import datetime, time, timezone

from app.schemas.analysis import (
    AnalysisRequest, Direction, EphemerisResult, GeometrySample, HorizonSample,
    ImageryResult, Provenance, ProviderResult, TerrainResult, VisibilityResult,
    VisibilitySample,
)


def provenance(provider: str) -> Provenance:
    return Provenance(
        mode="mock", provider=provider, algorithm_version="fixed-fixture-1",
        assumptions=["Fixed illustrative values independent of coordinates and duration."],
        limitations=["No NASA datasets or kernels used.", "Not scientifically validated or suitable for operational decisions."],
    )


class MockTerrainProvider:
    def get_terrain(self, request: AnalysisRequest) -> ProviderResult[TerrainResult]:
        return ProviderResult(
            value=TerrainResult(
                elevation_m=-1200, vertical_datum="undefined-mock-reference", slope_deg=7.5,
                horizon=[HorizonSample(azimuth_deg=0, elevation_deg=5)], coverage="fixture-only",
            ), provenance=provenance(type(self).__name__),
        )


class MockEphemerisProvider:
    def get_geometry(self, request: AnalysisRequest) -> ProviderResult[EphemerisResult]:
        # Date labels the fixture only; no time-dependent geometry is computed.
        timestamp = datetime.combine(request.landing_date, time(12), timezone.utc)
        return ProviderResult(
            value=EphemerisResult(
                samples=[GeometrySample(utc=timestamp,
                    sun=Direction(azimuth_deg=175, elevation_deg=12),
                    earth_center=Direction(azimuth_deg=0, elevation_deg=4))],
                frame="illustrative-local-horizon-not-a-SPICE-frame", kernel_ids=[], coverage="fixture-only",
            ), provenance=provenance(type(self).__name__),
        )


class MockImageryProvider:
    def get_imagery(self, request: AnalysisRequest) -> ProviderResult[ImageryResult]:
        return ProviderResult(
            value=ImageryResult(local_asset_path=None, product_id=None,
                description="Mock imagery placeholder; no NASA image has been loaded."),
            provenance=provenance(type(self).__name__),
        )


class MockVisibilityAnalysisProvider:
    def analyze(self, request: AnalysisRequest, terrain: ProviderResult[TerrainResult],
                ephemeris: ProviderResult[EphemerisResult]) -> ProviderResult[VisibilityResult]:
        # Deliberately does not calculate visibility from the terrain or angles.
        return ProviderResult(
            value=VisibilityResult(samples=[VisibilitySample(utc=sample.utc,
                sunlight=True, earth_geometric_visibility=False)
                for sample in ephemeris.value.samples], coverage="fixture-only"),
            provenance=provenance(type(self).__name__),
        )
