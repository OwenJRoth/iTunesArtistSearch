const { createApp } = Vue;

createApp({
  data() {
    return {
      searchQuery: '',
      searchResults: [],
      originalResults: [],
      favorites: JSON.parse(localStorage.getItem('favorites')) || [],
      currentTrack: null,
      isPlaying: false,
      isRepeatOn: false,
      progress: 0,
      volume: 70,
      progressInterval: null,
      mediaType: 'music',
      isLoading: false,
      audioElement: new Audio(),
      availableGenres: new Set(),
      activeGenres: new Set(['all']),
      sortOption: 'original',
      searchHistory: JSON.parse(localStorage.getItem('searchHistory')) || [],
      showSearchHistory: false,
      hovered: null
    };
  },
  computed: {
    filteredResults() {
      let results = this.searchResults;
      
      if (!this.activeGenres.has('all') && this.availableGenres.size > 0) {
        results = results.filter(result => 
          result.primaryGenreName && this.activeGenres.has(result.primaryGenreName)
        );
      }
      
      switch (this.sortOption) {
        case 'collection':
          return [...results].sort((a, b) => {
            const aName = a.collectionName || 'No information provided';
            const bName = b.collectionName || 'No information provided';
            return aName.localeCompare(bName);
          });
        case 'price':
          return [...results].sort((a, b) => {
            const aPrice = a.trackPrice || 0;
            const bPrice = b.trackPrice || 0;
            return aPrice - bPrice;
          });
        default:
          return results.slice().sort((a, b) => {
            return this.originalResults.findIndex(item => item.trackId === a.trackId) - 
                   this.originalResults.findIndex(item => item.trackId === b.trackId);
          });
      }
    },
    topFiveHistory() {
      return this.searchHistory.slice(0, 5);
    }
  },
  watch: {
    mediaType(newVal, oldVal) {
      if (newVal !== oldVal && this.searchQuery.trim()) {
        this.searchArtists();
      }
    }
  },
  methods: {
    async searchArtists() {
      if (!this.searchQuery.trim()) {
        this.searchResults = [];
        this.originalResults = [];
        this.availableGenres = new Set();
        return;
      }
      
      this.updateSearchHistory(this.searchQuery);
      
      this.isLoading = true;
      this.searchResults = [];
      this.originalResults = [];
      this.activeGenres = new Set(['all']);
      this.sortOption = 'original';
      this.showSearchHistory = false;
      
      try {
        let url = `https://itunes.apple.com/search?term=${encodeURIComponent(this.searchQuery)}&limit=50`;
        if (this.mediaType !== 'all') {
          url += `&media=${this.mediaType}`;
        }
        
        const response = await axios.get(url);
        this.searchResults = response.data.results || [];
        this.originalResults = [...this.searchResults];
        this.extractGenres(this.searchResults);
        
        if (this.searchResults.length === 0) {
          console.log("No results found for:", this.searchQuery);
        }
      } catch (error) {
        console.error("Search error:", error);
        this.searchResults = [];
        this.originalResults = [];
        alert("Failed to search. Please try again.");
      } finally {
        this.isLoading = false;
      }
    },
    
    updateSearchHistory(query) {
      const index = this.searchHistory.indexOf(query);
      if (index !== -1) {
        this.searchHistory.splice(index, 1);
      }
      this.searchHistory.unshift(query);
      localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
    },
    
    onInputClick() {
      this.showSearchHistory = true;
    },
    
    clickHistoryItem(item) {
      this.searchQuery = item;
      this.searchArtists();
    },
    
    deleteHistory(index) {
      this.searchHistory.splice(index, 1);
      localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
    },
    
    handleClickOutside(event) {
      if (!this.$refs.searchBar.contains(event.target)) {
        this.showSearchHistory = false;
      }
    },
    
    extractGenres(results) {
      const genres = new Set();
      results.forEach(result => {
        if (result.primaryGenreName) {
          genres.add(result.primaryGenreName);
        }
      });
      this.availableGenres = genres;
    },
    
    toggleGenre(genre) {
      if (genre === 'all') {
        this.activeGenres = new Set(['all']);
      } else {
        const updatedGenres = new Set(this.activeGenres);
        updatedGenres.delete('all');
        
        if (updatedGenres.has(genre)) {
          updatedGenres.delete(genre);
          if (updatedGenres.size === 0) {
            updatedGenres.add('all');
          }
        } else {
          updatedGenres.add(genre);
        }
        
        this.activeGenres = updatedGenres;
      }
    },
    
    setSortOption(option) {
      this.sortOption = option;
    },
    
    isCurrentTrack(track) {
      return this.currentTrack && (
        (this.currentTrack.trackId && this.currentTrack.trackId === track.trackId) ||
        (this.currentTrack.collectionId && this.currentTrack.collectionId === track.collectionId)
      );
    },
    
    handleCardPlayback(track) {
      if (!track.previewUrl) {
        alert('No preview available for this track');
        return;
      }

      if (this.isCurrentTrack(track)) {
        this.togglePlay();
      } else {
        this.playTrack(track);
      }
    },
    
    handleFavoritePlayback(fav) {
      if (!fav.previewUrl) {
        alert('No preview available for this favorite');
        return;
      }

      if (this.isCurrentTrack(fav)) {
        this.togglePlay();
      } else {
        this.playTrack(fav);
      }
    },
    
    playTrack(track) {
      this.audioElement.pause();
      clearInterval(this.progressInterval);

      this.currentTrack = track;
      this.audioElement.src = track.previewUrl;
      this.audioElement.volume = this.volume / 100;
      this.audioElement.loop = this.isRepeatOn;
      
      this.audioElement.play()
        .then(() => {
          this.isPlaying = true;
          this.startProgress();
        })
        .catch(error => {
          console.error('Playback failed:', error);
          alert('Could not play the preview. It may be restricted in your region.');
        });
    },
    
    togglePlay() {
      if (!this.currentTrack) return;
      
      if (this.isPlaying) {
        this.audioElement.pause();
      } else {
        this.audioElement.play();
      }
      this.isPlaying = !this.isPlaying;
    },
    
    toggleRepeat() {
      this.isRepeatOn = !this.isRepeatOn;
      this.audioElement.loop = this.isRepeatOn;
    },
    
    nextTrack() {
      if (this.filteredResults.length === 0) return;
      
      this.progress = 0;
      if (this.isRepeatOn) {
        this.playTrack(this.currentTrack);
      } else {
        const currentIndex = this.filteredResults.findIndex(
          track => track.trackId === this.currentTrack?.trackId
        );
        const nextIndex = (currentIndex + 1) % this.filteredResults.length;
        const nextTrack = this.filteredResults[nextIndex];
        
        if (nextTrack.previewUrl) {
          this.playTrack(nextTrack);
        } else {
          this.nextTrack(); // Skip tracks without previews
        }
      }
    },
    
    prevTrack() {
      this.progress = 0;
      this.playTrack(this.currentTrack);
    },
    
    shuffle() {
      if (this.filteredResults.length > 0) {
        let randomIndex;
        let attempts = 0;
        const maxAttempts = 10;
        
        // Try to find a track with preview URL
        do {
          randomIndex = Math.floor(Math.random() * this.filteredResults.length);
          attempts++;
        } while (
          !this.filteredResults[randomIndex].previewUrl && 
          attempts < maxAttempts
        );
        
        const randomTrack = this.filteredResults[randomIndex];
        if (randomTrack.previewUrl) {
          this.playTrack(randomTrack);
        } else {
          alert('Selected item has no preview available');
        }
      }
    },
    
    startProgress() {
      clearInterval(this.progressInterval);
      this.progress = 0;
      
      const duration = 30;
      const increment = 100 / duration;
      
      this.progressInterval = setInterval(() => {
        this.progress += increment;
        if (this.progress >= 100) {
          if (this.isRepeatOn) {
            this.progress = 0;
            this.audioElement.currentTime = 0;
            this.audioElement.play();
          } else {
            this.nextTrack();
          }
        }
      }, 1000);
    },
    
    stopPlayback() {
      this.audioElement.pause();
      this.isPlaying = false;
      clearInterval(this.progressInterval);
      this.currentTrack = null;
      this.progress = 0;
    },
    
    changeVolume() {
      this.audioElement.volume = this.volume / 100;
    },
    
    toggleFavorite(item) {
      const index = this.favorites.findIndex(fav => 
        fav.trackId === item.trackId || 
        (fav.collectionId && fav.collectionId === item.collectionId)
      );
      
      if (index >= 0) {
        this.favorites.splice(index, 1);
      } else {
        this.favorites.push(item);
      }
      this.saveFavorites();
    },
    
    isFavorite(item) {
      return this.favorites.some(fav => 
        fav.trackId === item.trackId || 
        (fav.collectionId && fav.collectionId === item.collectionId)
      );
    },
    
    removeFavorite(index) {
      this.favorites.splice(index, 1);
      this.saveFavorites();
    },
    
    saveFavorites() {
      localStorage.setItem('favorites', JSON.stringify(this.favorites));
    },
    
    handleImageError(event) {
      event.target.src = './assets/default-artwork.png';
    },
    
    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    }
  },
  filters: {
    formatDate(value) {
      const date = new Date(value);
      return date.toLocaleDateString();
    }
  },
  mounted() {
    document.addEventListener('click', this.handleClickOutside);
    
    // Handle audio ended event
    this.audioElement.addEventListener('ended', () => {
      if (!this.isRepeatOn) {
        this.isPlaying = false;
        clearInterval(this.progressInterval);
      }
    });
  },
  beforeUnmount() {
    this.audioElement.pause();
    clearInterval(this.progressInterval);
    document.removeEventListener('click', this.handleClickOutside);
    this.audioElement.removeEventListener('ended');
  }
}).mount('#app');