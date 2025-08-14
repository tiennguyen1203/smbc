import React, { useState, useEffect } from 'react';
import { Search, Filter, Play, Eye, Heart, Clock, Tag } from 'lucide-react';
import { videoService, Video } from '../services/videoService';
import { Link } from 'react-router-dom';

interface VideoListProps {
  category?: string;
  searchQuery?: string;
}

const VideoList: React.FC<VideoListProps> = ({ category, searchQuery }) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchQuery || '');
  const [selectedCategory, setSelectedCategory] = useState(category || '');

  const loadVideos = async (pageNum: number, reset = false) => {
    try {
      setLoading(true);
      let response;
      
      if (searchTerm) {
        response = await videoService.searchVideos(searchTerm, pageNum);
      } else {
        response = await videoService.listVideos(pageNum, 20, selectedCategory);
      }
      
      if (reset) {
        setVideos(response.videos);
      } else {
        setVideos(prev => [...prev, ...response.videos]);
      }
      
      setHasMore(response.videos.length === 20);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos(1, true);
  }, [searchTerm, selectedCategory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      loadVideos(1, true);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadVideos(page + 1);
    }
  };

  const handleCategoryChange = (newCategory: string) => {
    setSelectedCategory(newCategory === selectedCategory ? '' : newCategory);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => loadVideos(1, true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search videos..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Search
          </button>
        </form>

        <div className="mt-4">
          <div className="flex items-center space-x-2 mb-3">
            <Filter className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Categories:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {['general', 'entertainment', 'education', 'sports', 'news', 'music', 'gaming'].map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {videos.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No videos found</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {videos.map((video) => (
          <div key={video.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
            <Link to={`/video/${video.id}`}>
              <div className="relative aspect-video bg-gray-200">
                {video.thumbnail_path ? (
                  <img
                    src={`${import.meta.env.VITE_API_URL}${video.thumbnail_path}`}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="h-12 w-12 text-gray-400" />
                  </div>
                )}
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                  {formatDuration(video.duration)}
                </div>
                {video.status === 'processing' && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="text-white text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                      <p className="text-sm">Processing...</p>
                    </div>
                  </div>
                )}
              </div>
            </Link>
            
            <div className="p-4">
              <Link to={`/video/${video.id}`}>
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 hover:text-primary-600 transition-colors">
                  {video.title}
                </h3>
              </Link>
              
              <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                {video.description}
              </p>
              
              <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                <div className="flex items-center space-x-4">
                  <span className="flex items-center">
                    <Eye className="h-4 w-4 mr-1" />
                    {formatViews(video.views)}
                  </span>
                  <span className="flex items-center">
                    <Heart className="h-4 w-4 mr-1" />
                    {formatViews(video.likes)}
                  </span>
                </div>
                <span className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {formatDate(video.created_at)}
                </span>
              </div>
              
              {video.tags.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Tag className="h-4 w-4 text-gray-400" />
                  <div className="flex flex-wrap gap-1">
                    {video.tags.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {video.tags.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        +{video.tags.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="text-center py-8">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="px-6 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoList;
