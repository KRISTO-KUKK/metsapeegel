const rawBasePath = process.env.NEXT_PUBLIC_METSATARK_BASE_PATH ?? "";

export const appBasePath =
  rawBasePath && rawBasePath !== "/" ? rawBasePath.replace(/\/$/, "") : "";

export function withBasePath(path: string) {
  if (!path.startsWith("/")) {
    return path;
  }

  if (!appBasePath || path.startsWith(`${appBasePath}/`) || path === appBasePath) {
    return path;
  }

  return `${appBasePath}${path}`;
}
