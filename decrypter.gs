class Decrypter {

  /** 
   * @constructor
   * @param {object} param
   * @param {object} [param.metaDataSettings] keys for developer meta data - best to allow the defaults
   * 
   */

  constructor({ metaDataSettings } = {}) {
    // these are the metadata access keys
    this._metaDataSettings = metaDataSettings || CrypterMeta.defaultMeta;
    Trackmyself.stamp()
  }
  /**
   * get encryption instructions
   */
  get settings() {
    return this._settings
  }
  /**
   * get standard metadata settings
   */
  get metaDataSettings() {
    return this._metaDataSettings
  }


  /**
   * decrypt an item
   * @param {object} param
   * @param {string} param.publicKey the public key
   * @param {string} param.privateKey the private key
   * @param {string} param.item the thing to be decrypted
   * @returns {*} the decrypted item
   */
  _decrypt({ publicKey, privateKey, item }) {
    return bmSimpleCrypto.GasCrypt.newCrypto(publicKey + privateKey).decrypt(item)
  }


  /**
   * decrypt
   * do the decryption
   * @param {object} param
   * @param {Array<CrypterResponse>} [param.settings] the private keys that were distributed
   * @param {boolean} [param.removeEncrypted=false] whether to remove the encryped columns
   * @returns {Fiddler[]} an array of updated fiddlers
   */
  exec({ settings = [], removeEncrypted = false } = {}) {

    // decorate the settings with fiddlers and public keys
    const decorated = settings.map(item => {
      const fiddler = bmPreFiddler.PreFiddler().getFiddler(item)
      const publicKey = this._getPublicKey({ fiddler })
      return {
        item,
        fiddler,
        publicKey
      }
    }).reduce((p, c) => {
      // an entry for a spreadsheet
      if (!p.has(c.item.id)) {
        p.set(c.item.id, new Map())
      }
      // an entry for a sheet
      if (!p.get(c.item.id).has(c.item.sheetName)) {
        p.get(c.item.id).set(c.item.sheetName, {
          fiddler: c.fiddler,
          columns: []
        })
      }
      // an item pushed for each column
      p.get(c.item.id).get(c.item.sheetName).columns.push(c)
      return p;
    }, new Map());

    // check and decrypt
    for (const spreadsheet of decorated.values()) {
      for (const sheetName of spreadsheet.values()) {
        const { columns, fiddler } = sheetName
        const columnNames = columns.map(f => f.item.columnName)
        const unravelled = this._validateLocations({ fiddler, columnNames })
        // now we can decrypt and enhance the fiddler
        // only decrypt those in the  that exist in the sheet
        columns
          .filter((column) => fiddler.getHeaders().indexOf(column.item.columnName) !== -1)
          .forEach((column) => {
            const { privateKey, columnName } = column.item
            const { publicKey } = column
            const decryptName = columnName + "_decrypted"
            // if the decrypted version of the column doesnt exist, insert it
            if (fiddler.getHeaders().indexOf(decryptName) === -1) fiddler.insertColumn(decryptName, columnName)
            // now the decryption
            // after this the fiddler will contain the decrypted version of all the encrypted columns we know the key for
            fiddler.mapRows(row => {
              try {
                row[decryptName] = this._decrypt({ publicKey, privateKey, item: row[columnName] })
              } catch (err) {
                throw new Error('Something went wrong decrypting column ' + columnName + ' you probably have the wrong private key')
              }
              return row
            })
          })
        //remove the columns that were encrypted
        if (removeEncrypted) {
          fiddler.filterColumns(columnName => !unravelled.find(f => f.value === columnName))
        }
      }
    }
    // extract the updated fiddler and return them
    return Array.from(decorated.values()).reduce((p, spreadsheet) => {
      for (const sheetName of spreadsheet.values()) {
        p.push(sheetName.fiddler)
      }
      return p;
    }, [])
  }

  /**
   * get column metadata and unravel
   * @param {object} param
   * @param {sheet} param.sheet the sheet to match against
   * @param {boolean} param.complain whether to complain
   * @returns {DeveloperMetadata[]} the results organized by column name
  */
  unraveller({ sheet, complain = true }) {
    const metaDataSettings = this.metaDataSettings
    const meta = CrypterMeta.findMetaData({ sheet, metaDataSettings })
    if (complain &&  (!meta || !meta.length)) throw new Error('no meta data found for sheet ' + sheet.getName())
    return (meta || []).map(m => CrypterMeta.unravelMeta(m))
  }


  /**
   * get column metadata and unravel
   * @param {object} param
   * @param {Fiddler} param.fiddler the fiddler to match against
   * @returns {DeveloperMetadata[]} the results organized by column name
  */
  getUnravel({ fiddler }) {
    return this.unraveller({ sheet: fiddler.getSheet() })
  }
  /**
   * check that the location matches our expectation
   * this is a double check there's been no fiddling around
   * the columnname in the develeper metadata must match the current column name
   * there'll be a warning if the location has moved
   * @param {object} param
   * @param {Fiddler} param.fiddler the fiddler to match against
   * @param {string[]} param.columnNames the target columnnames
   * @returns {object[]} the unravelled developer data results organized by column name
  */
  _validateLocations({ fiddler, columnNames }) {
    // this should all match
    const fSheet = fiddler.getSheet()
    const fHeaders = fiddler.getHeaders()
    const fid = fSheet.getParent().getId()

    // make the meta data more digestable
    const unravelled = this.getUnravel({ fiddler })
console.log(unravelled)
    // lets be very strict for now - it should not have moved or been changed in any way
    columnNames.forEach(name => {
      const fColumn = fHeaders.indexOf(name)
      const m = unravelled.find(f => f.value === name)
      if (!m) throw new Error('no location data found in the developer metadata for column ' + name)
      const range = fiddler.getSheet().getRange(m.a1)
      if (range.getColumn() !== fColumn + 1) {
        console.log('warning ', 'location has moved for ' + name)
      }
      if (range.getSheet().getParent().getId() !== fid) throw new Error('data is in the wrong spreadsheet for ' + name)
      if (range.getSheet().getSheetId() !== fSheet.getSheetId()) throw new Error('data is in the wrong sheet for ' + name)
      return m
    })
    return unravelled
  }

  /**
   * get the spreadsheet of a fiddler
   * @param {object} param
   * @param {Fiddler} param.fiddler the fiddler to match against
   * @return {Spreadsheet}
   */
  _getSpreadsheet({ fiddler }) {
    return fiddler.getSheet().getParent()
  }

  /**
   * get the publicKey of the spreadsheet
   * @param {object} param
   * @param {Fiddler} param.fiddler the fiddler to match against
   * return {string} publicKey 
   */
  _getPublicKey({ fiddler }) {
    // get the public key
    const publicKeys = CrypterMeta.findSpreadsheetMetaData({ spreadsheet: this._getSpreadsheet({ fiddler }), metaDataSettings: this.metaDataSettings })
    if (!publicKeys || !publicKeys.length) throw new Error("public key not found")
    return publicKeys[0].getValue()
  }

  /**
   * find column metadata
   * @param {object} param
   * @param {sheet} param.sheet the spreadsheet to match against
   * @return {DeveloperMetaData[]}
   */
  findMeta({ sheet }) {
    return CrypterMeta.findMetaData({ sheet, metaDataSettings: this.metaDataSettings })
  }


  /**
   * find column metadata
   * @param {object} param
   * @param {Fiddler} param.fiddler the fiddler to match against
   * @return {DeveloperMetaData[]}
   */
  _findMetaData({ fiddler }) {
    return this.findMeta({ sheet: fiddler.getSheet() })
  }

  /**
   * find spreadsheet metadata
   * @param {object} param
   * @return {DeveloperMetaData[]}
   */
  _findSpreadsheetMetaData() {
    return CrypterMeta.findSpreadsheetMetaData({ spreadsheet: this._spreadsheet, metaDataSettings: this.metaDataSettings })
  }


  /**
   * find spreadsheet metadata
   * @param {object} param
   * @return {DeveloperMetaData[]}
   */
  _findSpreadsheetMetaData({ fiddler }) {
    const metaData = this.metaDataSettings
    const { keys, visibility } = metaData
    return this._getSpreadsheet({ fiddler }).createDeveloperMetadataFinder().withKey(keys.public).withVisibility(visibility).find()
  }


}

// export for library
/**
 * clone and encrypt selected columns from selected sheets
 * @param {object} param
 * @param {object} [param.metaDataSettings] keys for developer meta data - best to allow the defaults
 */
var newDecrypter = ({ metaDataSettings } = {}) => new Decrypter({ metaDataSettings })





