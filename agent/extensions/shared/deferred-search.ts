export interface SearchableMetadata {
	name: string;
	description?: string;
}

function termsFor(query: string): string[] {
	return query.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
}

function score(item: SearchableMetadata, terms: string[]): number {
	const name = item.name.toLowerCase();
	const description = (item.description ?? "").toLowerCase();

	return terms.reduce((total, term) => {
		if (name === term) return total + 8;
		if (name.includes(term)) return total + 4;
		if (description.includes(term)) return total + 2;
		return total;
	}, 0);
}

export function searchMetadata<T extends SearchableMetadata>(items: T[], query: string, limit = 5): T[] {
	const terms = termsFor(query);

	return items
		.map((item) => ({ item, score: score(item, terms) }))
		.filter(({ score: itemScore }) => itemScore > 0)
		.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
		.slice(0, limit)
		.map(({ item }) => item);
}
