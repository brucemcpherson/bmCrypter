/**
 * generates a private key - default is a random one
 * @name generatePrivateKey
 * @function
 * @param {String} [masterId] the id of the source spreadsheet
 * @param {String} [sheetName] the sheetName of the source sheet
 * @param {String} [columnName] the columnName of the source column
 * @returns {String} the private key
 */

/**
 * Description of the function
 * @name generatePublicKey - default is a ramdom one
 * @function
 * @returns {String} the public key
 */

/**
 * @type CrypterMaster
 * @property {string} id input spreadsheet id
 * @property {Array<CrypterSheet>} sheets the sheets to operate on
 * @property {CrypterClone} clone the clone definition
 */

/**
 * @type CrypterClone
 * @property {string} id the id of the target spreadsheet
 * @property {boolean} [createifMissing=true] whether to create sheets that don't exist yet
 * @property {generatePublicKey} generatePublicKey how to make a public key
 */

/**
 * @type CrypterSheet
 * @property {string} name the sheet name
 * @property {Array<string>} copy the lis of sheets to copy - astrisk wildcards allowed
 * @property {Array<string>} copy the list of sheets to encrypt - astrisks wildcards allowed
 * @property {generatePrivateKey} generatePrivateKey how to make a private key
 * @property {string|null} renameAs a property getter how to rename the the target sheet - if null will keep the same name as source
 */

/**
 * @type CrypterSettings
 * @property {Array<object>} masters
 * @property {CrypterClone} clone
 */

/**
 * @type CrypterResponse
 * @property {string} id the spreadsheet id
 * @property {string} sheetName the sheet name
 * @property {string} columnName the column name
 * @property {string} privateKey the private ley
 */
class Crypter {

  /** 
   * @constructor
   * @param {object} param
   * @param {CrypterSettings} param.settings work definition
   * @param {object} [param.metaDataSettings] keys for developer meta data - best to allow the defaults
   * 
   */
  constructor({ settings, metaDataSettings }) {
    // these are the settings for the specific sheets
    this._settings = settings
    // these are the metadata access keys
    this._metaDataSettings = metaDataSettings || CrypterMeta.defaultMeta;
    this._spreadsheet = SpreadsheetApp.openById(this._settings.clone.id)
  }
  /**a
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
   * get a random string
   */
  _randomString() {
    return bmSimpleCrypto.GasCrypt.randomString()
  }

  /**
   * encrypt
   * do the encryption
   * @returns {Array<CrypterResponse>} the private keys for distribution
   */
  exec() {

    // get the clone instructions
    const clonable = this._getClonable()

    // the public key will be written to the spreadsheet level developer meta data
    const generatePublicKey = this.settings.clone.generatePublicKey || this._randomString
    const publicKey = generatePublicKey()

    // do the cloning
    this._clone(clonable, publicKey)

    // dump the cloned values
    this._dump(clonable)

    // update the developer data
    this._setDeveloperData({ clonable, publicKey })

    return this._getPrivateKeys({ clonable })
  }

  /**
   * clear all the current relevant meta data, and write the new stuff
   * @param {object} param
   * @param {Map} param.clonable the cloned sheets
   * @param  {string} param.publicKey the public Key
   */
  _setDeveloperData({ clonable, publicKey }) {

    // clear the existing public key and write a new one
    this._clearPublicKey()
    this._tagPublicKey({ publicKey })

    // clear the column level data
    for (const clone of clonable.values()) {
      // clear the old stuff
      const { fiddler } = clone
      this._clearDeveloperData({ fiddler })
      this._tagMetaData(clone)
    }


  }
  /**
   * clear all the current relevant meta data, and write the new stuff
   * @param {object} param
   * @param {fiddler} param.fiddler the fiddler
   * @param {string} param.publicKey the public Key
   * @param {DeveloperMetaData[]} any found dev developer data
   */
  _clearDeveloperData({ fiddler }) {
    return this._findMetaData({ fiddler }).map(m => {
      m.remove()
      return m
    })
  }
  /**
 * clear all the current relevant meta data, and write the new stuff
 * @param {object} param
 * @param {string} param.publicKey the public Key
 * @param {DeveloperMetaData[]} any found dev developer data
 */
  _clearPublicKey() {
    return this._findSpreadsheetMetaData().map(m => {
      m.remove()
      return m;
    })
  }


  /**
   * add column level meta data
   * @param {object} param
   * @param {Fiddler} param.fiddler the fiddler to match against
   * @param {object} param.encryptColumns the  columns to encrypt
   * @returns {Range[]} the ranges that dev data applies to
  */
  _tagMetaData({ fiddler, encryptColumns }) {
    const metaData = this.metaDataSettings
    const { keys, visibility } = metaData
    const sheet = fiddler.getSheet()
    const columns = encryptColumns.map(e => e.columnName)

    return fiddler.getRangeList(columns).getRanges()
      .map((r, i) => sheet.getRange(r.getA1Notation().replace(/([^\d]+).*/, "$1:$1"))
        .addDeveloperMetadata(keys.encrypted, columns[i], visibility))
  }

  /**
   * add public key
   * @param {object} param
   * @returns {Range[]} the ranges that dev data applies to
  */
  _tagPublicKey({ publicKey }) {
    return this._spreadsheet.addDeveloperMetadata('simple-crypto-public', publicKey, this.metaDataSettings.visibility)
  }

  /**
   * find column metadata
   * @param {object} param
   * @param {Fiddler} param.fiddler the fiddler to match against
   * @return {DeveloperMetaData[]}
   */
  _findMetaData({ fiddler }) {
    return CrypterMeta.findMetaData({ fiddler, metaDataSettings: this.metaDataSettings })
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
   * encrypt an item
   * @param {object} param
   * @param {string} param.publicKey the public key
   * @param {string} param.privateKey the private key
   * @param {*} param.item the thing to be encrypted
   * @returns {string} the encrypted string
   */
  _encrypt({ publicKey, privateKey, item }) {
    return CrypterMeta.encrypt({ publicKey, privateKey, item })
  }

  /**
   * modify the fiddlers to copy and encrypt
   * @param {Map} clonable the masters that need to be cloned and encrypted
   * @param {string} publicKey the public key of the spreadsheet to be created
   * @returns {Map} the updated map
   */
  _clone(clonable, publicKey) {

    for (const clone of clonable.values()) {
      // get rid of columns not required
      const { encryptColumns, copyColumns, fiddler } = clone
      fiddler.filterColumns((name) => copyColumns.find(f => name === f.columnName))

      // modify the fiddler data by encrypting by the public key and the column private key
      fiddler.mapRows((row) => {
        encryptColumns.forEach(c => row[c.columnName] = this._encrypt({ publicKey, privateKey: c.privateKey, item: row[c.columnName] }))
        return row
      })
    }
    return clonable
  }

  /**
   * get privateKeys
   * this returns all the private keys that were used so they can be distributed to column owners
   * @param {Map} clonable the masters that need to be cloned and encrypted
   * @returns {object} the provate keys by sheet/colummn
   */
  _getPrivateKeys({ clonable }) {

    return Array.from(clonable.values())

      .reduce((p, clone) => {
        const { cloneName, encryptColumns, cloneFiddler } = clone
        encryptColumns.forEach(({ columnName, privateKey }) => {
          p.push({
            id: cloneFiddler.getSheet().getParent().getId(),
            sheetName: cloneName,
            columnName,
            privateKey
          })
        })
        return p;
      }, [])

  }
  /**
  * dump all the cloned sheets
  * @param {Map} clonable the masters that need to be cloned and encrypted
  * @returns {Map} the updated map
  */
  _dump(clonable) {
    // make output fiddlers for all the clones
    for (const item of clonable.values()) {
      item.cloneFiddler = bmPreFiddler.PreFiddler().getFiddler({ 
        ...this.settings.clone, 
        sheetName: item.cloneName 
      })
      // replace the clonefiddler data with the encrypted and dump
      item.cloneFiddler.setData(item.fiddler.getData()).dumpValues()
    }
    return clonable
  }

  _getClonable() {

    // now make a map of the data to be cloned
    return this.settings.masters.reduce((p, master) => {
      // 
      master.sheets.forEach(s => {
        // generate what the sheet will be called in the new 
        const cloneName = s.renameAs || s.name;
        // default is no encryption
        if (!s.encrypt) s.encrypt = [];

        // check its not a dup
        if (p.has(cloneName)) throw new Error("Would create duplicate sheet name " + cloneName)

        // now check that the encypted columns all exist
        const fiddler = bmPreFiddler.PreFiddler().getFiddler({ sheetName: s.name, id: master.id })
        const headers = fiddler.getHeaders();

        if (s.encrypt.length && !s.encrypt.every(f => headers.find(h => this._isMatch(h, f)))) {
          throw new Error("Some of the encrypted columns dont exist:" + s.encrypt.join(",") + " on sheet " + s.name)
        }

        if (!s.copy.every(f => headers.find(h => this._isMatch(h, f)))) {
          throw new Error("Some of the columns dont exist:" + s.copy.join(",") + " on sheet " + s.name)
        }

        // all is good we can add this sheet to the map of those needing processed
        p.set(cloneName, {
          ...s,
          cloneName,
          fiddler,
          // you can assign some logic here to group private keys
          // this example generates a random one for each output columnname
          encryptColumns: headers.filter(f => s.encrypt.some(g => this._isMatch(f, g))).map(columnName => ({
            columnName,
            privateKey: s.generatePrivateKey(master.id, s.name, columnName)
          })),
          // copy + encrypted columns + remove dups
          copyColumns: headers
            .filter(f => s.copy.some(g => this._isMatch(f, g))).concat(s.encrypt).filter((f, i, a) => a.indexOf(f) === i).map(f => ({
              columnName: f
            }))
        })
      })
      return p

    }, new Map)

  }

  _isMatch(text, match) {
    return new RegExp("^" + match.split("*")
      .map(s => s.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1")).join(".*") + "$").test(text);
  }
}

// export for library

/**
 * clone and encrypt selected columns from selected sheets
 * @param {object} param
 * @param {CrypterSettings} param.settings work definition
 * @param {object} [param.metaDataSettings] keys for developer meta data - best to allow the defaults
 */
var newCrypter = ({ settings, metaDataSettings }) => new Crypter({ settings, metaDataSettings })





