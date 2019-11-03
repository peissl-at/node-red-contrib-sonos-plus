const SonosHelper = require('./SonosHelper.js');
const helper = new SonosHelper();

module.exports = function (RED) {
  'use strict';

  /**  Create Get Status Node and subscribe to messages
  * @param  {object} config current node configuration data
  */
  function SonosGetStatusNode (config) {
    RED.nodes.createNode(this, config);

    // validate config node. if valid then set status and subscribe to messages
    const node = this;
    const configNode = RED.nodes.getNode(config.confignode);
    const isValid = helper.validateConfigNodeV3(configNode);
    const sonosFunction = 'create node get status';
    if (isValid) {
      // clear node status
      node.status({});
      // subscribe and handle input message (the different requests are chained)
      node.on('input', function (msg) {
        node.debug('node on - msg received');
        // check again configNode - in the meantime it might have changed
        const isStillValid = helper.validateConfigNodeV3(configNode);
        if (isStillValid) {
          helper.identifyPlayerProcessInputMsg(node, configNode, msg, function (ipAddress) {
            if (typeof ipAddress === 'undefined' || ipAddress === null ||
              (typeof ipAddress === 'number' && isNaN(ipAddress)) || ipAddress === '') {
            // error handling node status, node error is done in identifyPlayerProcessInputMsg
            } else {
              node.debug('Found sonos player');
              handleInputMsg(node, msg, ipAddress);
            }
          });
        } else {
          helper.showErrorV2(node, msg, new Error('n-r-c-s-p: invalid config node', sonosFunction));
        }
      });
    } else {
      // no msg available!
      const msgShort = 'setup subscribe - invalid configNode';
      const errorDetails = 'Please modify config node';
      node.error(`${sonosFunction} - ${msgShort} Details: ` + errorDetails);
      node.status({ fill: 'red', shape: 'dot', text: `error:${sonosFunction} - ${msgShort}` });
    }
  }

  /**  Validate sonos player and input message then dispatch further.
  * @param  {Object} node current node
  * @param  {object} msg incoming message
  * @param  {string} ipaddress IP address of sonos player
  */
  function handleInputMsg (node, msg, ipaddress) {
    // get sonos player
    const { Sonos } = require('sonos');
    const sonosPlayer = new Sonos(ipaddress);
    const sonosFunction = 'handle input msg';
    if (typeof sonosPlayer === 'undefined' || sonosPlayer === null ||
      (typeof sonosPlayer === 'number' && isNaN(sonosPlayer)) || sonosPlayer === '') {
      helper.showErrorV2(node, msg, new Error('n-r-c-s-p: undefined sonos player'), sonosFunction);
      return;
    }

    // Check msg.payload. Store lowercase version in command
    if (typeof msg.payload === 'undefined' || msg.payload === null ||
      (typeof msg.payload === 'number' && isNaN(msg.payload)) || msg.payload === '') {
      helper.showErrorV2(node, msg, new Error('n-r-c-s-p: undefined payload', sonosFunction));
      return;
    }

    let command = String(msg.payload);
    command = command.toLowerCase();

    // dispatch
    if (command === 'get_basics') {
      getBasicsV1(node, msg, sonosPlayer);
    } else if (command === 'get_state') {
      getPlayerStateV3(node, msg, sonosPlayer);
    } else if (command === 'get_volume') {
      getPlayerVolumeV3(node, msg, sonosPlayer);
    } else if (command === 'get_muted') {
      getPlayerMutedV3(node, msg, sonosPlayer);
    } else if (command === 'get_name') {
      getPlayerNameV3(node, msg, sonosPlayer);
    } else if (command === 'get_led') {
      getPlayerLedStatus(node, msg, sonosPlayer);
    } else if (command === 'get_properties') {
      getPlayerProperties(node, msg, sonosPlayer);
    } else if (command === 'get_songmedia') {
      getPlayerSongMediaV1(node, msg, sonosPlayer);
    } else if (command === 'get_songinfo') {
      getPlayerCurrentSongV1(node, msg, sonosPlayer);
    } else if (command === 'get_mediainfo') {
      getMediaInfoV1(node, msg, sonosPlayer);
    } else if (command === 'get_positioninfo') {
      getPositionInfoV1(node, msg, sonosPlayer);
    } else {
      helper.showWarning(node, sonosFunction, 'dispatching commands - invalid command', 'command-> ' + JSON.stringify(command));
    }
  }

  // -----------------------------------------------------
  // Commands
  // -----------------------------------------------------

  /** Get the SONOS basic data and output to msg.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer sonos player object
  * @output msg: state, volume, volumeNormalized, muted, name, group
  */
  function getBasicsV1 (node, msg, sonosPlayer) {
    const sonosFunction = 'get basics';
    let state; let volume; let normalizedVolume; let muted; let sonosName; let sonosGroup;

    sonosPlayer.getCurrentState()
      .then((response) => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          throw new Error('n-r-c-s-p: undefined player state received', sonosFunction);
        }
        state = response;
        return true;
      })
      .then(() => { return sonosPlayer.getVolume(); })
      .then(response => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          throw new Error('n-r-c-s-p: undefined player volume received', sonosFunction);
        }
        volume = response;
        normalizedVolume = response / 100.0;
        return true;
      })
      .then(() => { return sonosPlayer.getMuted(); })
      .then(response => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          throw new Error('n-r-c-s-p: undefined player muted state received', sonosFunction);
        }
        muted = response;
        return true;
      })
      .then(() => { return sonosPlayer.getName(); })
      .then(response => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          throw new Error('n-r-c-s-p: undefined player name received', sonosFunction);
        }
        sonosName = response;
        return true;
      })
      .then(() => { return sonosPlayer.zoneGroupTopologyService().GetZoneGroupAttributes(); })
      .then(response => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          throw new Error('n-r-c-s-p: undefined zone group attributes received', sonosFunction);
        }
        sonosGroup = response;
        return true;
      })
      .then(() => {
        helper.showSuccess(node, sonosFunction);
        msg.state = state; msg.volume = volume; msg.volumeNormalized = normalizedVolume; msg.muted = muted; msg.name = sonosName; msg.group = sonosGroup;
        node.send(msg);
      })
      .catch(error => helper.showErrorV2(node, msg, error, sonosFunction));
  }

  /** Get the sonos player state and outputs.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer sonos player object
  * @output changes msg.payload
  */
  function getPlayerStateV3 (node, msg, sonosPlayer) {
    const sonosFunction = 'get player state';

    sonosPlayer.getCurrentState()
      .then((response) => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          throw new Error('n-r-c-s-p: undefined player state received', sonosFunction);
        }
        node.debug('got valid player state');
        helper.showSuccess(node, sonosFunction);
        msg.payload = response;
        node.send(msg);
      })
      .catch(error => helper.showErrorV2(node, msg, error, sonosFunction));
  }

  /** Get the sonos player volume and outputs.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer sonos player object
  * @output changes msg.payload
  */
  function getPlayerVolumeV3 (node, msg, sonosPlayer) {
    const sonosFunction = 'get player volume';

    sonosPlayer.getVolume()
      .then(response => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '' || isNaN(response)) {
          throw new Error('n-r-c-s-p: undefined player volume received', sonosFunction);
        }
        if (!Number.isInteger(response)) {
          throw new Error('n-r-c-s-p: invalid volume received', sonosFunction);
        }
        node.debug('got valid player volume');
        helper.showSuccess(node, sonosFunction);
        msg.payload = response;
        node.send(msg);
      })
      .catch(error => helper.showErrorV2(node, msg, error, sonosFunction));
  }

  /** Get the sonos player muted state and outputs.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer sonos player object
  * @output changes msg.payload
  */
  function getPlayerMutedV3 (node, msg, sonosPlayer) {
    const sonosFunction = 'get player muted state';

    sonosPlayer.getMuted()
      .then((response) => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          throw new Error('n-r-c-s-p: undefined mute state received', sonosFunction);
        }
        node.debug('got valid mute state');
        helper.showSuccess(node, sonosFunction);
        msg.payload = response;
        node.send(msg);
      })
      .catch(error => helper.showErrorV2(node, msg, error, sonosFunction));
  }

  /** Get the sonos player name and outputs.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer sonos player object
  * @output changes msg.payload
  */
  function getPlayerNameV3 (node, msg, sonosPlayer) {
    const sonosFunction = 'get player name';
    sonosPlayer.getName()
      .then((response) => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          throw new Error('n-r-c-s-p: undefined player name received', sonosFunction);
        }
        node.debug('got valid player name');
        helper.showSuccess(node, sonosFunction);
        msg.payload = response;
        node.send(msg);
      })
      .catch(error => helper.showErrorV2(node, msg, error, sonosFunction));
  }

  /** Get the sonos player LED light status and outputs to payload.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer sonos player object
  * @output changes msg.payload in On or Off
  */
  function getPlayerLedStatus (node, msg, sonosPlayer) {
    const sonosFunction = 'get player LED status';
    sonosPlayer.getLEDState()
      .then(response => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          throw new Error('n-r-c-s-p: undefined player properties received', sonosFunction);
        }
        // should be On or Off
        node.debug('got valid LED status');
        helper.showSuccess(node, sonosFunction);
        msg.payload = response;
        node.send(msg);
      })
      .catch(error => helper.showErrorV2(node, msg, error, sonosFunction));
  }

  /** Get the sonos player properties and outputs to payload.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer sonos player object
  * @output changes msg.payload
  */
  function getPlayerProperties (node, msg, sonosPlayer) {
    const sonosFunction = 'get player properties';
    sonosPlayer.deviceDescription()
      .then(response => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          throw new Error('n-r-c-s-p: undefined player properties received', sonosFunction);
        }
        node.debug('got valid group attributes');
        helper.showSuccess(node, sonosFunction);
        msg.payload = response;
        node.send(msg);
      })
      .catch(error => helper.showErrorV2(node, msg, error, sonosFunction));
  }

  /** Get the sonos player current song, media and position and outputs.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer sonos player object
  * @output msg: artist, title, albumArtURL, queueActivated, song, media and position
  */
  function getPlayerSongMediaV1 (node, msg, sonosPlayer) {
    const sonosFunction = 'get songmedia';

    let artist = 'unknown'; // as default
    let title = 'unknown'; // as default
    let albumArtURL = '';

    sonosPlayer.currentTrack()
      .then(response => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          throw new Error('n-r-c-s-p: undefined current song received', sonosFunction);
        }
        // modify albumArtURL property
        if (typeof response.albumArtURI === 'undefined' || response.albumArtURI === null ||
          (typeof response.albumArtURI === 'number' && isNaN(response.albumArtURI)) || response.albumArtURI === '') {
          // TuneIn does not provide AlbumArtURL -so we continue
        } else {
          node.debug('got valid albumArtURI');
          const port = 1400;
          albumArtURL = 'http://' + sonosPlayer.host + ':' + port + response.albumArtURI;
        }
        // extract artist and title if available
        if (typeof response.artist === 'undefined' || response.artist === null ||
          (typeof response.artist === 'number' && isNaN(response.artist)) || response.artist === '') {
          // missing artist: TuneIn provides artist and title in title field
          if (typeof response.title === 'undefined' || response.title === null ||
              (typeof response.title === 'number' && isNaN(response.title)) || response.title === '') {
            helper.showWarning(node, sonosFunction, 'no artist, no title', 'received-> ' + JSON.stringify(response));
            return;
          } else {
            if (response.title.indexOf(' - ') > 0) {
              node.debug('could split data to artist and title');
              artist = response.title.split(' - ')[0];
              title = response.title.split(' - ')[1];
            } else {
              helper.showWarning(node, sonosFunction, 'invalid combination artist title received', 'received-> ' + JSON.stringify(response));
              return;
            }
          }
        } else {
          artist = response.artist;
          if (typeof response.title === 'undefined' || response.title === null ||
              (typeof response.title === 'number' && isNaN(response.title)) || response.title === '') {
            // title unknown
          } else {
            title = response.title;
            node.debug('got artist and title');
          }
        }
        node.debug('got valid song info');
        msg.song = response;
        msg.albumArtURL = albumArtURL;
        msg.artist = artist;
        msg.title = title;
        return true;
      })
      .then(() => { return sonosPlayer.avTransportService().GetMediaInfo(); })
      .then((response) => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          throw new Error('n-r-c-s-p: undefined media info received', sonosFunction);
        }
        if (typeof response.CurrentURI === 'undefined' || response.CurrentURI === null ||
          (typeof response.CurrentURI === 'number' && isNaN(response.CurrentURI)) || response.CurrentURI === '') {
          throw new Error('n-r-c-s-p: undefined CurrentURI received', sonosFunction);
        }
        const uri = response.CurrentURI;
        msg.queueActivated = (uri.startsWith('x-rincon-queue'));
        msg.media = response;
        return true;
      })
      .then(() => { return sonosPlayer.avTransportService().GetPositionInfo(); })
      .then((response) => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          throw new Error('n-r-c-s-p: undefined position info received', sonosFunction);
        }
        msg.position = response;
        return true;
      })
      .then(() => {
        helper.showSuccess(node, sonosFunction);
        node.send(msg);
        return true;
      })
      .catch(error => helper.showErrorV2(node, msg, error, sonosFunction));
  }

  /** Get the sonos player current song and outputs.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer sonos player object
  * @output msg:  artist, title, albumArtURL and song
  */
  function getPlayerCurrentSongV1 (node, msg, sonosPlayer) {
    const sonosFunction = 'get current song';

    let artist = 'unknown'; // as default
    let title = 'unknown'; // as default
    let albumArtURL = '';

    sonosPlayer.currentTrack()
      .then(response => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          throw new Error('n-r-c-s-p: undefined current song received', sonosFunction);
        }
        // modify albumArtURL property
        if (typeof response.albumArtURI === 'undefined' || response.albumArtURI === null ||
          (typeof response.albumArtURI === 'number' && isNaN(response.albumArtURI)) || response.albumArtURI === '') {
          // TuneIn does not provide AlbumArtURL -so we continure
        } else {
          node.debug('got valid albumArtURI');
          const port = 1400;
          albumArtURL = 'http://' + sonosPlayer.host + ':' + port + response.albumArtURI;
        }
        // extract artist and title if available
        if (typeof response.artist === 'undefined' || response.artist === null ||
          (typeof response.artist === 'number' && isNaN(response.artist)) || response.artist === '') {
          // missing artist: TuneIn provides artist and title in title field
          if (typeof response.title === 'undefined' || response.title === null ||
              (typeof response.title === 'number' && isNaN(response.title)) || response.title === '') {
            helper.showWarning(node, sonosFunction, 'no artist, no title', 'received-> ' + JSON.stringify(response));
            return;
          } else {
            if (response.title.indexOf(' - ') > 0) {
              node.debug('could split data to artist and title');
              artist = response.title.split(' - ')[0];
              title = response.title.split(' - ')[1];
            } else {
              helper.showWarning(node, sonosFunction, 'invalid combination artist title received', 'received-> ' + JSON.stringify(response));
              return;
            }
          }
        } else {
          artist = response.artist;
          if (typeof response.title === 'undefined' || response.title === null ||
              (typeof response.title === 'number' && isNaN(response.title)) || response.title === '') {
            // title unknown
          } else {
            title = response.title;
            node.debug('got artist and title');
          }
        }
        node.debug('got valid song info');
        msg.payload = response;
        msg.albumArtURL = albumArtURL;
        msg.artist = artist;
        msg.title = title;
      })
      .then(() => {
        helper.showSuccess(node, sonosFunction);
        node.send(msg);
        return true;
      })
      .catch(error => helper.showErrorV2(node, msg, error, sonosFunction));
  }

  /** Get the media info and outputs.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer sonos player object
  * @output msg: queueActivated, payload = media
  */
  function getMediaInfoV1 (node, msg, sonosPlayer) {
    const sonosFunction = 'get media info';

    sonosPlayer.avTransportService().GetMediaInfo()
      .then((response) => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          throw new Error('n-r-c-s-p: undefined media info received', sonosFunction);
        }
        if (typeof response.CurrentURI === 'undefined' || response.CurrentURI === null ||
          (typeof response.CurrentURI === 'number' && isNaN(response.CurrentURI)) || response.CurrentURI === '') {
          throw new Error('n-r-c-s-p: undefined CurrentURI received', sonosFunction);
        }
        const uri = response.CurrentURI;
        msg.queueActivated = (uri.startsWith('x-rincon-queue'));
        msg.payload = response;
        return true;
      })
      .then(() => {
        helper.showSuccess(node, sonosFunction);
        node.send(msg);
        return true;
      })
      .catch(error => helper.showErrorV2(node, msg, error, sonosFunction));
  }

  /** Get the position info and outputs.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer sonos player object
  * @output msg: payload = position
  */
  function getPositionInfoV1 (node, msg, sonosPlayer) {
    const sonosFunction = 'get position info';

    sonosPlayer.avTransportService().GetPositionInfo()
      .then((response) => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          throw new Error('n-r-c-s-p: undefined position info received', sonosFunction);
        }
        msg.payload = response;
        return true;
      })
      .then(() => {
        helper.showSuccess(node, sonosFunction);
        node.send(msg);
        return true;
      })
      .catch(error => helper.showErrorV2(node, msg, error, sonosFunction));
  }

  RED.nodes.registerType('sonos-get-status', SonosGetStatusNode);
};
