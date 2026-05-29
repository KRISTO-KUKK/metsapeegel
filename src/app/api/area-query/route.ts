import { NextRequest, NextResponse } from "next/server";
import { runAreaQuery } from "@/lib/data/areaQuery";
import type { AreaQueryFilterId } from "@/lib/types/forestry";

function parseBbox(value: string | null): [number, number, number, number] | null {
  if (!value) {
    return null;
  }

  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const [west, south, east, north] = parts;
  const insideEstoniaEnvelope =
    west >= 20.5 &&
    east <= 30 &&
    south >= 56.7 &&
    north <= 60.5 &&
    west < east &&
    south < north;

  return insideEstoniaEnvelope ? [west, south, east, north] : null;
}

function parseFilter(value: string | null): AreaQueryFilterId | null {
  if (
    value === "no_protection_overlap" ||
    value === "protection_overlap" ||
    value === "inventory_year" ||
    value === "inventory_before_year" ||
    value === "ownership_form" ||
    value === "has_forest_notice" ||
    value === "no_forest_notice" ||
    value === "has_wood_raw_material" ||
    value === "has_carbon_storage" ||
    value === "no_registry_stands" ||
    value === "area_larger_than" ||
    value === "area_smaller_than" ||
    value === "many_registry_stands"
  ) {
    return value;
  }

  return null;
}

function parseYear(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const year = Number(value);
  if (!Number.isInteger(year) || year < 1990 || year > 2035) {
    return undefined;
  }

  return year;
}

function parseLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const limit = Number(value);
  return Number.isFinite(limit) ? limit : undefined;
}

function parseOwnershipForm(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 && normalized.length < 80 ? normalized : undefined;
}

function parsePositiveNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  const bbox = parseBbox(request.nextUrl.searchParams.get("bbox"));
  const filterId = parseFilter(request.nextUrl.searchParams.get("filter"));
  const year = parseYear(request.nextUrl.searchParams.get("year"));
  const beforeYear = parseYear(request.nextUrl.searchParams.get("beforeYear"));
  const ownershipForm = parseOwnershipForm(
    request.nextUrl.searchParams.get("ownershipForm")
  );
  const minAreaHa = parsePositiveNumber(
    request.nextUrl.searchParams.get("minAreaHa")
  );
  const maxAreaHa = parsePositiveNumber(
    request.nextUrl.searchParams.get("maxAreaHa")
  );
  const minStands = parsePositiveNumber(
    request.nextUrl.searchParams.get("minStands")
  );

  if (!bbox || !filterId) {
    return NextResponse.json(
      {
        error:
          "bbox and filter are required. filter must be no_protection_overlap or inventory_year."
      },
      { status: 400 }
    );
  }

  if (filterId === "inventory_year" && !year) {
    return NextResponse.json(
      { error: "inventory_year filter requires a valid year." },
      { status: 400 }
    );
  }
  if (filterId === "inventory_before_year" && !beforeYear) {
    return NextResponse.json(
      { error: "inventory_before_year filter requires a valid beforeYear." },
      { status: 400 }
    );
  }
  if (filterId === "ownership_form" && !ownershipForm) {
    return NextResponse.json(
      { error: "ownership_form filter requires ownershipForm." },
      { status: 400 }
    );
  }
  if (filterId === "area_larger_than" && !minAreaHa) {
    return NextResponse.json(
      { error: "area_larger_than filter requires minAreaHa." },
      { status: 400 }
    );
  }
  if (filterId === "area_smaller_than" && !maxAreaHa) {
    return NextResponse.json(
      { error: "area_smaller_than filter requires maxAreaHa." },
      { status: 400 }
    );
  }
  if (filterId === "many_registry_stands" && !minStands) {
    return NextResponse.json(
      { error: "many_registry_stands filter requires minStands." },
      { status: 400 }
    );
  }

  try {
    const result = await runAreaQuery({
      bbox,
      filterId,
      year,
      beforeYear,
      ownershipForm,
      minAreaHa,
      maxAreaHa,
      minStands,
      limit: parseLimit(request.nextUrl.searchParams.get("limit"))
    });

    return NextResponse.json(result);
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Area query failed."
      },
      { status: 502 }
    );
  }
}
