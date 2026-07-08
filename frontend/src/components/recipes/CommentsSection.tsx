import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recipesApi, type Comment } from "../../api/recipes";
import { useAuth } from "../../contexts/AuthContext";

interface Props {
  recipeId: number;
}

function CommentItem({ comment }: { comment: Comment }) {
  const initial = comment.author_email[0].toUpperCase();
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs font-semibold flex-shrink-0">
        {initial}
      </div>
      <div className="flex-1">
        <p className="text-xs text-gray-400 mb-1">{comment.author_email}</p>
        <p className="text-sm text-gray-800 leading-relaxed">{comment.body}</p>
        {comment.replies?.map((r) => (
          <div key={r.id} className="mt-3 ml-4 pl-3 border-l-2 border-gray-100">
            <p className="text-xs text-gray-400 mb-1">{r.author_email}</p>
            <p className="text-sm text-gray-700">{r.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CommentsSection({ recipeId }: Props) {
  const { isAuthenticated } = useAuth();
  const [body, setBody] = useState("");
  const queryClient = useQueryClient();

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", recipeId],
    queryFn: () => recipesApi.getComments(recipeId).then((r) => r.data),
  });

  const { mutate: addComment, isPending } = useMutation({
    mutationFn: (text: string) => recipesApi.addComment(recipeId, text),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["comments", recipeId] });
    },
  });

  return (
    <section>
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Comments{comments.length > 0 ? ` (${comments.length})` : ""}
      </h3>

      <div className="space-y-5 mb-6">
        {comments.length === 0 && (
          <p className="text-sm text-gray-400 italic">
            No comments yet. Be the first!
          </p>
        )}
        {comments.map((c) => (
          <CommentItem key={c.id} comment={c} />
        ))}
      </div>

      {isAuthenticated && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) addComment(body.trim());
          }}
          className="flex gap-2 items-end"
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            className="flex-1 border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            disabled={isPending || !body.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            Post
          </button>
        </form>
      )}
    </section>
  );
}
