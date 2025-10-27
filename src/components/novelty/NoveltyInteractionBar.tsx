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
    <div className="border-t border-b">
      {/* Section interactions sociales */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Button
          onClick={onLikeToggle}
          variant="ghost"
          size="sm"
          disabled={isPending}
          className={cn(
            "flex items-center gap-1.5 hover:bg-accent/50 text-muted-foreground",
            isLiked && "text-primary"
          )}
        >
          <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
          <span className="text-sm">{likesCount}</span>
        </Button>

        <Button
          onClick={onCommentsToggle}
          variant="ghost"
          size="sm"
          className={cn(
            "flex items-center gap-1.5 hover:bg-accent/50 text-muted-foreground",
            showComments && "text-primary"
          )}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm">{commentsCount}</span>
        </Button>
      </div>

      {/* Section boutons d'action CTA */}
      <div className="flex items-center justify-center gap-3 px-4 py-4 bg-gradient-to-r from-background via-accent/5 to-background">
        <Button
          onClick={onMeetingRequest}
          variant="default"
          size="default"
          className="flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow"
        >
          <Calendar className="h-4 w-4" />
          <span className="font-medium">Prendre RDV</span>
        </Button>

        {hasDownload && onBrochureDownload && (
          <Button
            onClick={onBrochureDownload}
            variant="outline"
            size="default"
            className="flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow border-primary/20 hover:border-primary/40"
          >
            <Download className="h-4 w-4" />
            <span className="font-medium">Télécharger</span>
          </Button>
        )}
      </div>
    </div>
  );
}
