import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useNoveltyComments, useAddComment, useDeleteComment } from '@/hooks/useNoveltyComments';
import { Button } from '@/components/ui/button';
import CommentInput from './CommentInput';
import CommentItem from './CommentItem';

interface NoveltyCommentsProps {
  noveltyId: string;
  showAll?: boolean;
}

export default function NoveltyComments({ noveltyId, showAll = false }: NoveltyCommentsProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAllComments, setShowAllComments] = useState(showAll);

  const { data: comments = [], isLoading } = useNoveltyComments(noveltyId);
  const addCommentMutation = useAddComment(noveltyId);
  const deleteCommentMutation = useDeleteComment(noveltyId);

  const handleSubmitComment = async (content: string, imageUrl?: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    await addCommentMutation.mutateAsync({ content, imageUrl });
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce commentaire ?')) {
      return;
    }

    try {
      await deleteCommentMutation.mutateAsync(commentId);
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Show first comment by default if there are comments
  const displayedComments = showAllComments ? comments : comments.slice(0, 1);
  const hasMoreComments = comments.length > 1;

  return (
    <div className="space-y-4">
      {/* Show first comment if exists */}
      {!isLoading && comments.length > 0 && (
        <div className="space-y-3">
          {displayedComments.map((comment) => {
            const isOwner = user?.id === comment.user_id;
            return (
              <CommentItem
                key={comment.id}
                comment={comment}
                isOwner={isOwner}
                onDelete={handleDeleteComment}
                isDeleting={deleteCommentMutation.isPending}
              />
            );
          })}

          {/* Show more button */}
          {hasMoreComments && !showAllComments && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllComments(true)}
              className="text-sm font-medium"
            >
              Afficher les {comments.length - 1} autres commentaire{comments.length - 1 > 1 ? 's' : ''}
            </Button>
          )}
        </div>
      )}

      {/* Add comment input */}
      {user ? (
        <CommentInput
          onSubmit={handleSubmitComment}
          isPending={addCommentMutation.isPending}
        />
      ) : (
        <div className="flex gap-3 items-center py-2">
          <div className="flex-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/auth')}
              className="w-full justify-start text-muted-foreground rounded-full border"
            >
              Ajouter un commentaire...
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
