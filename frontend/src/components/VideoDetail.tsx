import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Heart, Eye, Clock, Tag, MessageCircle, Send } from 'lucide-react';
import { videoService, Video } from '../services/videoService';
import VideoPlayer from './VideoPlayer';

interface Comment {
  id: string;
  content: string;
  username: string;
  created_at: string;
}

const VideoDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (id) {
      loadVideo();
      loadComments();
    }
  }, [id]);

  const loadVideo = async () => {
    try {
      const response = await videoService.getVideo(id!);
      console.log('VideoDetail: Loaded video data:', response.video);
      setVideo(response.video);
    } catch (err) {
      console.error('VideoDetail: Error loading video:', err);
      setError(err instanceof Error ? err.message : 'Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const response = await videoService.getComments(id!);
      setComments(response.comments);
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  };

  const handleLike = async () => {
    if (!video) return;
    
    try {
      await videoService.likeVideo(video.id);
      setVideo(prev => prev ? { ...prev, likes: prev.likes + 1 } : null);
      setLiked(true);
    } catch (err) {
      console.error('Failed to like video:', err);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() || !id) return;

    setSubmittingComment(true);
    try {
      const response = await videoService.addComment(id, commentContent);
      setComments(prev => [response.comment, ...prev]);
      setCommentContent('');
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatViews = (views: number): string => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 text-lg">{error || 'Video not found'}</p>
      </div>
    );
  }

  if (video.status !== 'ready') {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-lg text-gray-600">Video is still processing...</p>
        <p className="text-sm text-gray-500 mt-2">Please check back later</p>
      </div>
    );
  }

  const src = `${import.meta.env.VITE_API_URL}${video.video_url || video.file_path}`


  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="aspect-video">
          <VideoPlayer
            src={src}
            poster={video.thumbnail_url ? `${import.meta.env.VITE_API_URL}${video.thumbnail_url}` : undefined}
            className="w-full h-full"
          />
        </div>
        
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{video.title}</h1>
              <p className="text-gray-600 mb-4">{video.description}</p>
              
              <div className="flex items-center space-x-6 text-sm text-gray-500 mb-4">
                <span className="flex items-center">
                  <Eye className="h-4 w-4 mr-1" />
                  {formatViews(video.views)} views
                </span>
                <span className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {formatDate(video.created_at)}
                </span>
                {video.tags.length > 0 && (
                  <span className="flex items-center">
                    <Tag className="h-4 w-4 mr-1" />
                    {video.tags.join(', ')}
                  </span>
                )}
              </div>
            </div>
            
            <button
              onClick={handleLike}
              disabled={liked}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                liked
                  ? 'bg-red-100 text-red-600 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Heart className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} />
              <span>{formatViews(video.likes)}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Comments ({comments.length})
        </h3>
        
        <form onSubmit={handleCommentSubmit} className="mb-6">
          <div className="flex space-x-3">
            <input
              type="text"
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={submittingComment}
            />
            <button
              type="submit"
              disabled={!commentContent.trim() || submittingComment}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Send className="h-4 w-4" />
              <span>Comment</span>
            </button>
          </div>
        </form>
        
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="border-b border-gray-200 pb-4 last:border-b-0">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 font-medium text-sm">
                    {comment.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-gray-900">{comment.username}</span>
                    <span className="text-sm text-gray-500">{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="text-gray-700">{comment.content}</p>
                </div>
              </div>
            </div>
          ))}
          
          {comments.length === 0 && (
            <p className="text-gray-500 text-center py-8">No comments yet. Be the first to comment!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoDetail;