/** Text value of a form field ('' when missing or when it is a file). */
export function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
