var CrypterMeta = (() => {

  /**
   * find column metadata
   * @param {object} param
   * @param {sheet} param.sheet the sheet to match against
   * @param {object} param.metaDataSettings the meta data settings
   * @returns {DeveloperMetaData[]}
   */
  const findMetaData = ({ sheet, metaDataSettings }) => {
    const { keys, visibility } = metaDataSettings
    return sheet.createDeveloperMetadataFinder()
      .withKey(keys.encrypted)
      .withVisibility(visibility)
      .withLocationType(SpreadsheetApp.DeveloperMetadataLocationType.COLUMN)
      .find()
  }

  /**
   * find spreadsheet metadata
   * @param {object} param
   * @param {Spreadsheet} param.spreadsheet the spreadsheet to match against
   * @param {object} param.metaDataSettings the meta data settings
   * @return {DeveloperMetaData[]}
   */
  const findSpreadsheetMetaData = ({ spreadsheet, metaDataSettings }) => {
    const { keys, visibility } = metaDataSettings
    return spreadsheet.createDeveloperMetadataFinder()
      .withKey(keys.public)
      .withVisibility(visibility)
      .withLocationType(SpreadsheetApp.DeveloperMetadataLocationType.SPREADSHEET)
      .find()

  }

  /**
   * encrypt an item
   * @param {object} param
   * @param {string} param.publicKey the public key
   * @param {string} param.privateKey the private key
   * @param {*} param.item the thing to be encrypted
   * @returns {string} the encrypted string
   */
  const encrypt = ({ publicKey, privateKey, item }) => {
    return bmSimpleCrypto.GasCrypt.newCrypto(publicKey + privateKey).encrypt(item)
  }

  /**
   * decrypt an item
   * @param {object} param
   * @param {string} param.publicKey the public key
   * @param {string} param.privateKey the private key
   * @param {string} param.item the thing to be decrypted
   * @returns {*} the decrypted item
   */
  const decrypt = ({ publicKey, privateKey, item }) => {
    return bmSimpleCrypto.GasCrypt.newCrypto(publicKey + privateKey).decrypt(item)
  }

  const getAllMetaData = ({ spreadsheet }) => {
    return spreadsheet.createDeveloperMetadataFinder().find()
  }
  const clearAllMetaData = ({ spreadsheet }) => {
    return getAllMetaData({ spreadsheet }).map(r => {
      r.remove();
      return r;
    })
  }

  const unravelMeta = (meta) => {

    const location = meta.getLocation()
    const id = meta.getId()
    const value = meta.getValue()
    const key = meta.getKey()
    const visibility = meta.getVisibility()
    const sheet = location && location.getSheet()
    const sheetName = sheet && sheet.getName()
    const spreadsheet = location && location.getSpreadsheet()
    const spreadsheetId = spreadsheet && spreadsheet.getId()
    const row = location && location.getRow() && location.getRow().getRow()
    const column = location && location.getColumn() && location.getColumn().getColumn()
    const type = location && location.getLocationType()
    const range = location && 
      (type === SpreadsheetApp.DeveloperMetadataLocationType.COLUMN && location.getColumn()) || 
      (type === SpreadsheetApp.DeveloperMetadataLocationType.ROW && location.getRow())

    const a1 = range && range.getA1Notation()

    return {
      id,
      value,
      key,
      visibility: visibility.toString(),
      sheetName,
      spreadsheetId,
      row,
      column,
      type: type.toString(),
      a1
    }

  }

  // exports
  return {
    unravelMeta,
    clearAllMetaData,
    getAllMetaData,
    encrypt,
    decrypt,
    findSpreadsheetMetaData,
    findMetaData,
    defaultMeta: ({
      keys: {
        public: 'simple-crypto-public',
        encrypted: 'simple-crypto-encrypted'
      },
      visibility: SpreadsheetApp.DeveloperMetadataVisibility.DOCUMENT
    })
  }
})()


