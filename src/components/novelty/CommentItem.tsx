import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { NoveltyComment } from '@/hooks/useNoveltyComments';

interface CommentItemProps {
  comment: NoveltyComment;
  isOwner: boolean;
  onDelete: (commentId: string) => void;
  isDeleting: boolean;
}

export default function CommentItem({ comment, isOwner, onDelete, isDeleting }: CommentItemProps) {
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
    <div className="flex gap-3">
      <Avatar className="w-8 h-8 flex-shrink-0">
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
        <div className="bg-muted rounded-2xl px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">
              {getDisplayName(
                comment.profiles?.first_name || null,
                comment.profiles?.last_name || null
              )}
            </span>
          </div>
          
          <p className="text-sm break-words whitespace-pre-wrap">
            {comment.content}
          </p>

          {comment.image_url && (
            <img 
              src={comment.image_url} 
              alt="Comment attachment" 
              className="mt-2 max-w-full max-h-[300px] rounded-lg"
            />
          )}
        </div>

        <div className="flex items-center gap-3 mt-1 px-3">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), {
              addSuffix: true,
              locale: fr
            })}
          </span>

          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(comment.id)}
              disabled={isDeleting}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Supprimer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
