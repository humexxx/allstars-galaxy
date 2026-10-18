import { permanentRedirect } from "next/navigation";

/**
 * The methods catalogue now lives inside Portfolio (Methods tab). This route
 * stays as a permanent redirect rather than a 404 because the URL may be
 * bookmarked.
 */
export default function InvestmentMethodsPage(): never {
  permanentRedirect("/portal/portfolio");
}
