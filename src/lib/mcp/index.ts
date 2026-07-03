import { defineMcp } from "@lovable.dev/mcp-js";
import searchSalons from "./tools/search-salons";
import getSalon from "./tools/get-salon";
import listSectors from "./tools/list-sectors";
import searchExhibitors from "./tools/search-exhibitors";

export default defineMcp({
  name: "lotexpo-mcp",
  title: "Lotexpo MCP",
  version: "0.1.0",
  instructions:
    "Tools for Lotexpo, the reference directory of French professional trade shows (salons) and their exhibitors. Use `list_sectors` to discover sector labels, `search_salons` to find upcoming trade shows by keyword/sector/city, `get_salon` to fetch full details of one salon, and `search_exhibitors` to look up exhibiting companies.",
  tools: [searchSalons, getSalon, listSectors, searchExhibitors],
});