# Video Content Platform

A scalable, high-performance video content platform built with modern technologies and best practices. This platform includes a multi-step video processing pipeline, advanced caching strategies, and a responsive frontend with custom video controls.

## 🚀 Features

### Backend
- **Video Processing Pipeline**: Multi-step processing with RabbitMQ for background tasks
- **PostgreSQL Database**: Normalized schemas with proper indexing and constraints
- **Redis Caching**: Multi-tier caching system with TTLs and invalidation patterns
- **RESTful APIs**: Complete API with rate limiting and proper error handling
- **Video Processing**: FFmpeg integration for metadata extraction and thumbnail generation
- **Search Capability**: Full-text search with filters and pagination
- **Rate Limiting**: Express rate limiting for API protection
- **Swagger Documentation**: Complete API documentation

### Frontend
- **React + TypeScript**: Modern frontend with type safety
- **Custom Video Player**: Built with video.js and HLS.js support
- **Responsive Design**: Tailwind CSS for beautiful, responsive UI
- **Video Upload**: Drag & drop upload with progress tracking
- **Search & Filtering**: Advanced search with category filtering
- **Comments System**: Real-time comments with threading support
- **Modern UI/UX**: Skeleton loaders, error boundaries, and smooth animations

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   (React)       │◄──►│   (Express)     │◄──►│  (PostgreSQL)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │     Redis       │
                       │   (Caching)     │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   RabbitMQ      │
                       │ (Video Queue)   │
                       └─────────────────┘
```

## 🛠️ Technology Stack

### Backend
- **Node.js** with **TypeScript**
- **Express.js** framework
- **PostgreSQL** database
- **Redis** for caching
- **RabbitMQ** for message queuing
- **FFmpeg** for video processing
- **Multer** for file uploads
- **Swagger** for API documentation

### Frontend
- **React 18** with **TypeScript**
- **Vite** build tool
- **Tailwind CSS** for styling
- **React Router** for navigation
- **video.js** for video playback
- **HLS.js** for HLS streaming
- **Lucide React** for icons

### Infrastructure
- **Docker** and **Docker Compose**
- **PostgreSQL 15** database
- **Redis 7** cache
- **RabbitMQ 3** message broker

## 📋 Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Yarn package manager

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd video-platform
```

### 2. Start Services with Docker
```bash
docker-compose up -d
```

This will start:
- Backend API on port 5001
- Frontend on port 3000
- PostgreSQL on port 5432
- Redis on port 6379
- RabbitMQ on port 5672 (Management UI on 15672)

### 3. Setup Database
```bash
cd backend
yarn install
yarn db:migrate
```

### 4. Install Frontend Dependencies
```bash
cd frontend
yarn install
```

### 5. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001
- **API Documentation**: http://localhost:5001/api-docs
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)

## 🔧 Development

### Backend Development
```bash
cd backend
yarn install
yarn dev
```

### Frontend Development
```bash
cd frontend
yarn install
yarn dev
```

### Database Migrations
```bash
cd backend
yarn db:migrate
yarn db:seed
```

## 📚 API Endpoints

### Videos
- `POST /api/videos/upload` - Upload video
- `GET /api/videos` - List videos
- `GET /api/videos/:id` - Get video details
- `PUT /api/videos/:id` - Update video
- `DELETE /api/videos/:id` - Delete video
- `POST /api/videos/:id/like` - Like video
- `GET /api/videos/search` - Search videos

### Comments
- `GET /api/videos/:videoId/comments` - Get video comments
- `POST /api/videos/:videoId/comments` - Add comment

### Admin
- `GET /api/admin/cache-stats` - Cache statistics
- `GET /api/admin/health` - System health
- `POST /api/admin/cache/clear` - Clear cache
- `GET /api/admin/queue/stats` - Queue statistics

## 🎥 Video Processing Pipeline

1. **Upload**: Video file uploaded via API
2. **Validation**: File type and size validation
3. **Queue**: Job added to RabbitMQ processing queue
4. **Processing**: Background worker processes video
5. **Metadata**: Extract duration and generate thumbnail
6. **Storage**: Save processed files and update database
7. **Cache**: Invalidate relevant cache entries

## 💾 Caching Strategy

- **Video Metadata**: Cached with 5-minute TTL
- **Video Lists**: Cached with 1-minute TTL
- **Search Results**: Cached with 5-minute TTL
- **Cache Invalidation**: Pattern-based invalidation on updates
- **Hit/Miss Metrics**: Available via admin endpoint

## 🔍 Search Features

- Full-text search across video titles and descriptions
- Tag-based filtering
- Category filtering
- Pagination support
- Real-time search results

## 📱 Frontend Features

- **Responsive Design**: Works on all device sizes
- **Custom Video Controls**: Play, pause, volume, fullscreen
- **Drag & Drop Upload**: Intuitive file upload experience
- **Real-time Updates**: Live comment system
- **Error Handling**: Graceful error boundaries and fallbacks
- **Loading States**: Skeleton loaders and progress indicators

## 🚀 Performance Optimizations

- **Lazy Loading**: Route-based code splitting
- **Image Optimization**: Responsive thumbnails
- **Caching**: Multi-tier caching strategy
- **Database Indexing**: Optimized queries with proper indexes
- **CDN Ready**: Static file serving for scalability

## 🔒 Security Features

- **Rate Limiting**: API protection against abuse
- **Input Validation**: Comprehensive request validation
- **File Type Validation**: Secure file upload restrictions
- **CORS Configuration**: Proper cross-origin settings
- **Helmet.js**: Security headers

## 📊 Monitoring & Health Checks

- **Health Endpoint**: `/health` for system status
- **Cache Statistics**: Hit/miss ratios and key counts
- **Queue Monitoring**: RabbitMQ connection status
- **Database Health**: Connection and query performance
- **Error Logging**: Structured logging with Winston

## 🧪 Testing

```bash
# Backend tests
cd backend
yarn test

# Frontend tests
cd frontend
yarn test
```

## 📦 Deployment

### Production Build
```bash
# Backend
cd backend
yarn build
yarn start

# Frontend
cd frontend
yarn build
```

### Environment Variables
Create `.env` files in both backend and frontend directories:

**Backend (.env)**
```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:password@host:5432/database
REDIS_URL=redis://host:6379
RABBITMQ_URL=amqp://user:password@host:5672
JWT_SECRET=your-production-secret
```

**Frontend (.env)**
```env
VITE_API_URL=https://your-api-domain.com
```

## 🔄 Scaling Considerations

### Horizontal Scaling
- **Load Balancers**: Multiple backend instances
- **Database Replication**: Read replicas for queries
- **Redis Clustering**: Distributed caching
- **CDN Integration**: Global content delivery

### Performance Tuning
- **Database Optimization**: Query optimization and indexing
- **Cache Warming**: Pre-populate frequently accessed data
- **Background Jobs**: Async processing for heavy operations
- **Connection Pooling**: Efficient database connections

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation at `/api-docs`
- Review the system health at `/api/admin/health`

## 🎯 Roadmap

- [ ] User authentication and authorization
- [ ] Video playlists and collections
- [ ] Advanced analytics and metrics
- [ ] Mobile app development
- [ ] Live streaming capabilities
- [ ] AI-powered content recommendations
- [ ] Multi-language support
- [ ] Advanced video editing tools
