type ClassNameRow = { id: string; class_name: string };

function normalizeClassName(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("id-ID").replace(/[\s./_-]+/g, "");
}

function classNameKeys(value: string): string[] {
  const gradeSections = [...value.matchAll(/(\d+)\s*([a-z])/gi)].map((match) => `${match[1]}${match[2].toLocaleLowerCase("id-ID")}`);
  return [...new Set([
    normalizeClassName(value),
    ...value.split(/[\/|]/).map(normalizeClassName),
    ...gradeSections,
  ].filter(Boolean))];
}

export function buildClassNameLookup(classes: ClassNameRow[]): Map<string, string | null> {
  const lookup = new Map<string, string | null>();
  for (const classRow of classes) {
    for (const key of classNameKeys(classRow.class_name)) {
      const current = lookup.get(key);
      lookup.set(key, current === undefined || current === classRow.id ? classRow.id : null);
    }
  }
  return lookup;
}

export function resolveClassId(lookup: Map<string, string | null>, value: string): string | null {
  const candidates = classNameKeys(value);
  const matches = new Set(candidates.map((key) => lookup.get(key)).filter((id): id is string => Boolean(id)));
  return matches.size === 1 ? [...matches][0] : null;
}

export function hasClassNameCandidate(lookup: Map<string, string | null>, value: string): boolean {
  return classNameKeys(value).some((key) => lookup.has(key));
}

export function isGradeSectionClassName(value: string): boolean {
  return /\d+\s*[a-z]\b/i.test(value);
}
