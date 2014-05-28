/**
 * WordPress Client.
 *
 * @todo Add support for 30X redirect.
 *
 * ### Events
 * * ready          - Once client instance created.
 * * connected      - Once client instance created and list of supported methods is returned.
 * * authenticated  - Once client instance created and list of supported methods is returned.
 * * error          - Emitted on any response error.
 *
 * ### Settings
 * * url            - URL to XML-RPC endpoint.
 * * username       - Username to use.
 * * password       - Password to use.
 * * blog           - ID of blog
 * * key            - As an alternative to usrname and password, if WordPress site supports it.
 * * methods        - Set with supported RPC methods once client connection is created.
 *
 * @param settings
 * @param callback
 * @returns {Client}
 * @constructor
 */
function Client( settings, callback ) {
  this.debug( 'new Client', settings.url );

  // Mixing settings and emitter into instance.
  require( 'object-emitter' ).mixin( this );
  require( 'object-settings' ).mixin( this );

  // Set defaults and instance settings.
  this.set( Client.defaults ).set( settings );

  // Set properties from parsed URL.
  this.set( 'hostname', this.common.parseURL( this.get( 'url' ) ).hostname );
  this.set( 'auth', this.common.parseURL( this.get( 'url' ) ).auth );

  // Instance Properties.
  Object.defineProperties( this, {
    __client: {
      value: this.common.createClient({
        url: settings.url,
        username: settings.username,
        password: settings.password,
        blogId: settings.blog || settings.blogId
      }),
      enumerable: false,
      configurable: true,
      writable: false
    },
    __queue: {
      value: [],
      enumerable: false,
      configurable: true,
      writable: false
    }
  });

  // Schedule initial RPC call to verify target is valid.
  this.listMethods( this.onceReady.bind( this ) );

  // Emit ready event on next tick.
  this.nextTick( this.emit, 'ready', null, this );

  // Schedule callback, if provided.
  if( 'function' === typeof callback ) {
    this.once( 'connected', callback );
  }

  // @chainable
  return this;

}

/**
 * Instance Properties.
 *
 */
Object.defineProperties( Client.prototype, {
  onceReady: {
    /**
     * Callback for Connection Verification.
     *
     * @todo Does not verify credentials.
     *
     * @param error
     * @param methods
     * @returns {*}
     */
    value: function onceReady( error, methods ) {
      this.debug( error ? 'No methods (%d) found, unable to connect to %s.' :'onceReady: Found %d methods on %s.', methods.length, this.get( 'url' ) );

      // Set Methods.
      this.set( 'methods', methods );

      if( error ) {
        this.emit( 'error', error, this );
      }

      this.emit( 'connected', error, this );

      // @chainable
      return this;

    },
    enumerable: true,
    configurable: true,
    writable: true
  },
  listMethods: {
    /**
     * Get Client Methods.
     *
     * @param callback
     * @returns {*}
     */
    value: function listMethods( callback ) {
      this.debug( 'listMethods' );
      this.__client.listMethods( callback );
      return this;
    },
    enumerable: true,
    configurable: true,
    writable: true
  },
  methodCall: {
    /**
     * Call Method
     *
     * @todo Add __queue use for request batching.
     *
     * @param method
     * @param args
     * @param callback
     * @returns {*}
     */
    value: function methodCall( method, args, callback ) {
      this.debug( 'methodCall', method );

      var self  = this;
      var body  = [].slice.call( args, 1 );

      /**
       * Handle RPC Method Callback.
       *
       * @param error
       * @param response
       * @returns {*}
       */
      function callbackWrapper( error, response ) {
        self.debug( 'methodCall->callbackWrapper', error, response );

        if ( error && error.code === "ENOTFOUND" && error.syscall === "getaddrinfo" ) {
          error.message = "Unable to connect to WordPress.";
          return fn( error );
        }

        callback.apply( this, arguments );

      }

      this.__client.rpc.methodCall( method, body, callbackWrapper );

      // @chainable
      return this;

    },
    enumerable: true,
    configurable: true,
    writable: true
  },
  uploadFile: {
    /**
     * Get Client Methods.
     *
     * ### Notes
     * * Uses "wp.uploadFile" RPC EP.
     *
     * ### Returns
     * * id
     * * file
     * * url
     * * type
     *
     * @param data            {Object}
     * @param data.name       {String}
     * @param data.type       {String}
     * @param data.bits       {String}
     * @param data.bits       {String}
     * @param data.overwrite  {Boolean}
     * @param data.post_id    {Integer}
     * @param callback        {Function}
     * @returns {*}
     */
    value: function uploadFile( data, callback ) {
      this.debug( 'uploadFile', data );

      this.methodCall([ this.get( 'blog' ), this.get( 'username' ), this.get( 'password' ), data, ], callback );

      return this;

    },
    enumerable: true,
    configurable: true,
    writable: true
  },
  getPosts: {
    /**
     * Get Client Methods.
     *
     * @param filter
     * @param callback
     * @returns {*}
     */
    value: function getPosts( filter, callback ) {
      this.debug( 'getPosts', filter );
      this.__client.getPosts( filter || { type: 'post' }, callback.bind( this ) );
      return this;
    },
    enumerable: true,
    configurable: true,
    writable: true
  },
  getPostTypes: {
    /**
     * Get Client Methods.
     *
     * @param callback
     * @returns {*}
     */
    value: function getPostTypes( callback ) {
      this.debug( 'getPostTypes' );
      this.__client.getPostTypes( callback );
      return this;
    },
    enumerable: true,
    configurable: true,
    writable: true
  },
  nextTick: {
    /**
     * Call Method on Next Tick.
     *
     * @param callback
     * @returns {*}
     */
    value: function nextTick( callback ) {

      var context = this;
      var args    = Array.prototype.slice.call( arguments, 1 );

      // Do not schedule callback if not a valid function.
      if( 'function' !== typeof callback ) {
        return this;
      }

      // Execute callback on next tick.
      process.nextTick( function nextTickHandler() {
        context.debug( 'nextTick', callback.name );
        callback.apply( context, args );
      });

      // @chainable
      return this;

    },
    enumerable: false,
    configurable: true,
    writable: true
  },
  debug: {
    value: require( 'debug' )( 'wordpress-client' ),
    enumerable: false,
    configurable: true,
    writable: true
  },
  common: {
    value: require( './common' ),
    enumerable: false,
    configurable: true,
    writable: true
  }
});

/**
 * Constructor Properties.
 *
 */
Object.defineProperties( module.exports = Client, {
  version: {
    value: require( '../package' ).version,
    enumerable: true,
    configurable: false,
    writable: false
  },
  defaults: {
    value: {
      username: process.env.WORDPRESS_CLIENT_USERNAME || undefined,
      password: process.env.WORDPRESS_CLIENT_PASSWORD || undefined,
      url: process.env.WORDPRESS_CLIENT_URL || undefined,
      methods: [],
      key: null,
      blog: 1
    },
    enumerable: true,
    configurable: true,
    writable: true
  },
  create: {
    /**
     * Create Client
     *
     * @param settings
     * @returns {Client}
     */
    value: function create( settings ) {
      return new Client( settings );
    },
    enumerable: true,
    configurable: true,
    writable: true
  }
});