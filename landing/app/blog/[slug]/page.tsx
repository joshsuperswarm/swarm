import { notFound } from "next/navigation";
import { CustomMDX } from "app/components/mdx";
import { formatDate, getBlogPosts } from "app/blog/utils";
import { baseUrl } from "app/sitemap";
import Link from "next/link";

const navItems = {
  "/": {
    name: "home",
  },
  "https://twitter.com/jmvldz": {
    name: "𝕏",
  },
};

export async function generateStaticParams() {
  let posts = getBlogPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export function generateMetadata({ params }) {
  let post = getBlogPosts().find((post) => post.slug === params.slug);
  if (!post) {
    return {
      title: "Not Found",
      description: "The page you are looking for does not exist.",
    };
  }

  let {
    title,
    publishedAt: publishedTime,
    summary: description,
    image,
  } = post.metadata;
  let ogImage = image
    ? image
    : `${baseUrl}/og?title=${encodeURIComponent(title)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime,
      url: `${baseUrl}/blog/${post.slug}`,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function Blog({ params }) {
  let post = getBlogPosts().find((post) => post.slug === params.slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white dark:from-gray-900 to-gray-50 dark:to-gray-800 text-gray-900 dark:text-gray-100">
      <main className="container mx-auto py-12 md:py-24">
        <div className="max-w-3xl mx-auto">
          <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                headline: post.metadata.title,
                datePublished: post.metadata.publishedAt,
                dateModified: post.metadata.publishedAt,
                description: post.metadata.summary,
                image: post.metadata.image
                  ? `${baseUrl}${post.metadata.image}`
                  : `/og?title=${encodeURIComponent(post.metadata.title)}`,
                url: `${baseUrl}/blog/${post.slug}`,
                author: {
                  "@type": "Person",
                  name: "My Portfolio",
                },
              }),
            }}
          />

          {/* Title */}
          <h1 className="font-mono text-2xl md:text-3xl text-gray-900 dark:text-gray-100 mb-2">
            {post.metadata.title}
          </h1>

          {/* Date */}
          <div className="mb-8">
            <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
              {formatDate(post.metadata.publishedAt)}
            </p>
          </div>

          {/* Article Content */}
          <article className="font-mono text-sm md:text-base leading-relaxed text-gray-900 dark:text-gray-100 prose prose-neutral dark:prose-invert max-w-none">
            <CustomMDX source={post.content} />
          </article>

          {/* Bottom Navigation */}
          <nav className="mt-12">
            <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
              {Object.entries(navItems).map(([path, { name }]) => {
                return (
                  <Link
                    key={path}
                    href={path}
                    className="font-mono text-sm md:text-base text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors mr-4"
                  >
                    {name}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </main>
    </div>
  );
}
