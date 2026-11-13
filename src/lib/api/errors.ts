/** Linha repetida (ex.: curtir duas vezes): o resultado desejado já existe, então conta como sucesso. */
export function isDuplicateError(e: { code?: string } | null | undefined): boolean {
  return e?.code === "23505";
}
