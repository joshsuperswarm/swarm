import Link from "next/link";
import { formatDate, getBlogPosts } from "app/blog/utils";

export function BlogPosts() {
  let allBlogs = getBlogPosts();

  return (
    <div className="space-y-4">
      {allBlogs
        .sort((a, b) => {
          if (
            new Date(a.metadata.publishedAt) > new Date(b.metadata.publishedAt)
          ) {
            return -1;
          }
          return 1;
        })
        .map((post) => (
          <Link
            key={post.slug}
            className="flex flex-col space-y-1"
            href={`/blog/${post.slug}`}
          >
            <div className="w-full flex flex-col md:flex-row md:items-baseline">
              <p className="font-mono text-sm md:text-base text-gray-600 w-[190px] shrink-0">
                {formatDate(post.metadata.publishedAt, false)}
              </p>
              <p className="font-mono text-sm md:text-base text-gray-600 hover:text-black transition-colors">
                {post.metadata.title}
              </p>
            </div>
          </Link>
        ))}
    </div>
  );
}
