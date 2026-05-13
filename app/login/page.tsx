import LoginPageClient from "./LoginPageClient";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  name: string
) {
  const value = searchParams[name];
  return Array.isArray(value) ? value[0] : value;
}

function buildQueryString(
  searchParams: Record<string, string | string[] | undefined>
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined) params.append(key, item);
      }
      continue;
    }

    if (value !== undefined) {
      params.set(key, value);
    }
  }

  const value = params.toString();
  return value ? `?${value}` : "";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const passwordSetupType = getSearchParam(resolvedSearchParams, "type");
  const hasPasswordSetupParams = Boolean(
    getSearchParam(resolvedSearchParams, "code") ||
      getSearchParam(resolvedSearchParams, "token_hash") ||
      passwordSetupType
  );

  return (
    <LoginPageClient
      nextPath={getSearchParam(resolvedSearchParams, "next") || "/"}
      hasPasswordSetupParams={hasPasswordSetupParams}
      passwordSetupType={passwordSetupType}
      searchQueryString={buildQueryString(resolvedSearchParams)}
    />
  );
}
