/** A validated page request; defaults are already applied. */
export interface IPageQuery {
  page: number;
  limit: number;
}

/** One page of rows plus the total matching the same scope and filters. */
export interface IPersistencePage<Item> {
  items: Item[];
  total: number;
}
