import { siteUrl } from '../lib/siteUrl'

export const baseUrl = siteUrl

export default async function sitemap() {
  return [
    { url: `${baseUrl}`, lastModified: new Date().toISOString().split('T')[0] }
  ];
}
