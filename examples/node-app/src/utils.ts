/** Страница списка: элементы страницы и номера соседних страниц */
export function paginate<T>(items: T[], page: number, size = 5) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    page: current,
    prevPage: Math.max(1, current - 1),
    nextPage: Math.min(pages, current + 1),
    hasPrev: current > 1,
    hasNext: current < pages,
  };
}
