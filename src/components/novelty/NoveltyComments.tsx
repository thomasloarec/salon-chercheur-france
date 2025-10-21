import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useNoveltyComments, useAddComment, useDeleteComment } from '@/hooks/useNoveltyComments';

interface NoveltyCommentsProps {
  noveltyId: string;
}

export default function NoveltyComments({ noveltyId }: NoveltyCommentsProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [newComment, setNewComment] = useState('');
  const [showCommentsList, setShowCommentsList] = useState(false);

  const { data: comments = [], isLoading } = useNoveltyComments(noveltyId);
  const addCommentMutation = useAddComment(noveltyId);
  const deleteCommentMutation = useDeleteComment(noveltyId);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!newComment.trim()) return;

    try {
      await addCommentMutation.mutateAsync(newComment);
      setNewComment('');
      // Show comments list after adding a comment
      setShowCommentsList(true);
    } catch (error) {
      console.error('Error submitting comment:', error);
    }
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

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
  };

  const getDisplayName = (firstName: string | null, lastName: string | null) => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) return firstName;
    if (lastName) return lastName;
    return 'Utilisateur';
  };

  return (
    <div className="border-t pt-4 space-y-4">
      {/* Add comment form - Always visible */}
      {user ? (
        <form onSubmit={handleSubmitComment} className="space-y-2">
          <div className="flex gap-3">
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarImage 
                src={user?.user_metadata?.avatar_url || undefined}
                alt="Votre photo"
              />
              <AvatarFallback className="text-xs">
                {getInitials(
                  user?.user_metadata?.first_name || null,
                  user?.user_metadata?.last_name || null
                )}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Ajouter un commentaire..."
                className="min-h-[80px] resize-none"
                maxLength={1000}
              />
            </div>
          </div>
          <div className="flex items-center justify-between pl-[52px]">
            <span className="text-xs text-muted-foreground">
              {newComment.length}/1000
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={!newComment.trim() || addCommentMutation.isPending}
            >
              {addCommentMutation.isPending ? (
                'Envoi...'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Publier
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Connectez-vous pour commenter
          </p>
          <Button size="sm" onClick={() => navigate('/auth')}>
            Se connecter
          </Button>
        </div>
      )}

      {/* Comments count and toggle */}
      {comments.length > 0 && (
        <button
          onClick={() => setShowCommentsList(!showCommentsList)}
          className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors w-full"
        >
          <MessageCircle className="h-4 w-4" />
          <span>
            {showCommentsList ? 'Masquer' : 'Voir'} {comments.length} commentaire{comments.length > 1 ? 's' : ''}
          </span>
        </button>
      )}

      {/* Comments list */}
      {showCommentsList && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-10 h-10 bg-muted rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/4" />
                    <div className="h-3 bg-muted rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => {
                const isOwner = user?.id === comment.user_id;
                
                return (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarImage 
                        src={comment.profiles?.avatar_url || undefined} 
                        alt={getDisplayName(
                          comment.profiles?.first_name || null,
                          comment.profiles?.last_name || null
                        )}
                      />
                      <AvatarFallback className="text-xs">
                        {getInitials(
                          comment.profiles?.first_name || null,
                          comment.profiles?.last_name || null
                        )}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-sm truncate">
                            {getDisplayName(
                              comment.profiles?.first_name || null,
                              comment.profiles?.last_name || null
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), {
                              addSuffix: true,
                              locale: fr
                            })}
                          </span>
                        </div>

                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 flex-shrink-0"
                            onClick={() => handleDeleteComment(comment.id)}
                            disabled={deleteCommentMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>

                      <p className="text-sm mt-1 break-words whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
