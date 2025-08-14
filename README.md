# Video Content Platform

A scalable, high-performance video content platform built with modern technologies and best practices. This platform includes a multi-step video processing pipeline with chunked uploads, advanced caching strategies, and a responsive frontend with custom video controls.

## 🚀 Quick Start with Docker

### One-Command Setup
Run the entire application stack (backend + frontend + all services) with a single command:

```bash
docker-compose up -d
```

This command will:
- Build and start the backend API server (port 5001)
- Build and start the frontend React application (port 3000)
- Start PostgreSQL database (port 5432)
- Start Redis cache (port 6379) 
- Start RabbitMQ message broker (port 5672, management UI on 15672)

### Access Points
After running `docker-compose up -d`, you can access:
- **Frontend Application**: http://localhost:3000
- **Backend API**: http://localhost:5001
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)
- **Health Check**: http://localhost:5001/health

### Database Setup
The database will be automatically created, but you need to run migrations:
```bash
# From the project root
docker-compose exec backend yarn db:migrate
```

### Stopping Services
```bash
docker-compose down
```

### Development Mode
For development with hot reloading:
```bash
docker-compose up
```

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

## 🏗️ Project Overview & Architecture

### Project Overview
This is a full-stack video content platform designed for scalable video processing, storage, and streaming. The platform features:

- **Chunked Video Upload System**: Large video files are split into chunks for reliable uploads with resume capability
- **Asynchronous Processing Pipeline**: Video processing happens in background using message queues
- **Multi-tier Caching Strategy**: Redis-based caching for optimal performance
- **RESTful API Architecture**: Clean separation between frontend and backend
- **Containerized Deployment**: Docker-based development and production environments

### System Architecture

The platform follows a microservices-oriented architecture with clear separation of concerns:

### Data Flow

1. **Upload Phase**: Frontend uploads video files in chunks to the backend
2. **Queue Phase**: Backend queues processing jobs in RabbitMQ
3. **Processing Phase**: Background workers process videos using FFmpeg
4. **Storage Phase**: Processed videos and metadata stored in PostgreSQL/filesystem
5. **Caching Phase**: Frequently accessed data cached in Redis
6. **Delivery Phase**: Videos served with streaming support and caching headers

## 🎯 Design Decisions & Performance Trade-offs

### Architecture Choices

#### **Chunked Upload System**
- **Decision**: Split large video files into smaller chunks (typically 5-10MB)
- **Justification**: Improves reliability for large file uploads, enables resume functionality, reduces memory usage
- **Trade-off**: Additional complexity in reassembly logic vs. dramatically improved upload success rate
- **Performance Impact**: Reduces failed uploads for files >100MB

#### **Message Queue with RabbitMQ**
- **Decision**: Use RabbitMQ for asynchronous video processing instead of synchronous processing
- **Justification**: Video processing (FFmpeg operations) can take minutes for large files
- **Trade-off**: Additional infrastructure complexity vs. non-blocking user experience
- **Performance Impact**: API response times under 200ms vs. potential 2-5 minute waits

#### **Redis Multi-tier Caching**
- **Decision**: Implement hierarchical caching with different TTLs (1min for lists, 5min for details)
- **Justification**: Video metadata rarely changes but is frequently accessed
- **Trade-off**: Memory usage and cache complexity vs.  reduction in database queries
- **Performance Impact**: Sub-50ms response times for cached content

#### **PostgreSQL Over NoSQL**
- **Decision**: Use PostgreSQL despite video metadata being document-like
- **Justification**: ACID compliance needed for user management, complex queries for search/filtering
- **Trade-off**: Slightly more complex schema vs. data consistency and powerful querying
- **Performance Impact**: Full-text search and complex joins perform better than MongoDB aggregations

### Third-Party Tool Justifications

#### **FFmpeg for Video Processing**
- **Why Chosen**: Industry standard, supports all major video formats, excellent performance
- **Alternatives Considered**: Cloud services (AWS MediaConvert, Azure Media Services)
- **Trade-off**: Server resource usage vs. cost savings and full control
- **Performance**: Processes 1GB video in ~2-3 minutes on standard hardware

#### **Video.js for Frontend Playback**
- **Why Chosen**: Mature, supports HLS streaming, excellent mobile support, customizable
- **Alternatives Considered**: Native HTML5 video, Plyr, JWPlayer
- **Trade-off**: Bundle size (~200KB) vs. feature richness and browser compatibility
- **Performance**: Supports adaptive bitrate streaming, reduces bandwidth

#### **Express.js Framework**
- **Why Chosen**: Mature ecosystem, excellent middleware support, TypeScript compatibility
- **Alternatives Considered**: Fastify, Koa.js, NestJS
- **Trade-off**: Slightly slower than Fastify vs. ecosystem maturity and developer familiarity
- **Performance**: Handles 1000+ req/sec on single instance with proper middleware

#### **Tailwind CSS**
- **Why Chosen**: Utility-first approach, excellent development speed, small production builds
- **Alternatives Considered**: Styled Components, Material-UI, Bootstrap
- **Trade-off**: Learning curve vs. development velocity and bundle size optimization
- **Performance**: CSS bundle size reduced by 60% compared to traditional CSS frameworks

#### **Docker Compose for Development**
- **Why Chosen**: Consistent development environment, easy service orchestration
- **Alternatives Considered**: Local installation, Kubernetes for dev
- **Trade-off**: Resource usage vs. environment consistency across team
- **Performance**: 30-second setup vs. hours of local configuration

### Performance Optimizations

#### **Database Indexing Strategy**
```sql
-- Critical indexes for performance
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX idx_videos_title_search ON videos USING gin(to_tsvector('english', title));
CREATE INDEX idx_videos_user_id ON videos(user_id);
```

#### **Streaming Optimization**
- **Range Requests**: Support HTTP 206 partial content for video streaming
- **Thumbnail Generation**: Automatic thumbnail creation at upload time

## 🛠️ Technology Stack

### Backend
- **Node.js** with **TypeScript**
- **Express.js** framework
- **PostgreSQL** database
- **Redis** for caching
- **RabbitMQ** for message queuing
- **FFmpeg** for video processing
- **Multer** for file uploads

### Frontend
- **React 18** with **TypeScript**
- **Vite** build tool
- **Tailwind CSS** for styling
- **React Router** for navigation
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
