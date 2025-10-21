import { Heart, MessageCircle, Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NoveltyInteractionBarProps {
  likesCount: number;
  isLiked: boolean;
  commentsCount: number;
  showComments: boolean;
  hasDownload: boolean;
  onLikeToggle: (e?: React.MouseEvent) => void;
  onCommentsToggle: (e?: React.MouseEvent) => void;
  onMeetingRequest: (e?: React.MouseEvent) => void;
  onBrochureDownload?: (e?: React.MouseEvent) => void;
  isPending?: boolean;
}

export default function NoveltyInteractionBar({
  likesCount,
  isLiked,
  commentsCount,
  showComments,
  hasDownload,
  onLikeToggle,
  onCommentsToggle,
  onMeetingRequest,
  onBrochureDownload,
  isPending = false,
}: NoveltyInteractionBarProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-t border-b">
      <Button
        onClick={onLikeToggle}
        variant="ghost"
        size="sm"
        disabled={isPending}
        className={cn(
          "flex items-center gap-2 hover:bg-accent",
          isLiked && "text-primary"
        )}
      >
        <Heart className={cn("h-5 w-5", isLiked && "fill-current")} />
        <span className="font-medium">{likesCount} Like{likesCount > 1 ? 's' : ''}</span>
      </Button>

      <Button
        onClick={onCommentsToggle}
        variant="ghost"
        size="sm"
        className={cn(
          "flex items-center gap-2 hover:bg-accent",
          showComments && "text-primary"
        )}
      >
        <MessageCircle className="h-5 w-5" />
        <span className="font-medium">{commentsCount} Commentaire{commentsCount > 1 ? 's' : ''}</span>
      </Button>

      <Button
        onClick={onMeetingRequest}
        variant="ghost"
        size="sm"
        className="flex items-center gap-2 hover:bg-accent"
      >
        <Calendar className="h-5 w-5" />
        <span className="font-medium hidden sm:inline">Rendez-vous</span>
        <span className="font-medium sm:hidden">RDV</span>
      </Button>

      {hasDownload && onBrochureDownload && (
        <Button
          onClick={onBrochureDownload}
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 hover:bg-accent"
        >
          <Download className="h-5 w-5" />
          <span className="font-medium hidden sm:inline">Brochure</span>
        </Button>
      )}
    </div>
  );
}
