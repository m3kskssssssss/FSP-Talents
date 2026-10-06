import { requireEmployer } from "@/server/http/guard";
import { parseQuery, route } from "@/server/http/route";
import { searchFiltersSchema } from "@/server/schemas/needs";
import { searchResults } from "@/server/services/matching";

/** Results of a saved search with filters applied over the original snapshot. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const me = await requireEmployer();
  const { page, ...filters } = parseQuery(req, searchFiltersSchema);
  return searchResults(me.employerId, params.id, filters, page);
});
