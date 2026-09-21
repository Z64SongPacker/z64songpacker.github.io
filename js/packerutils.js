import { SeqUtils } from "./sequtils.js";
import { MMCategories } from "./mmcategories.js";

export class PackerUtils{
    static async extractFileData(file) {
        var fileData = {};
        var ootrs = file.name.endsWith(".ootrs");

        try{
          // Open the file as a zip
          var zip = await JSZip.loadAsync(file);
          var promises = [];
          
          // Run over each file and extract data
          zip.forEach(function(path, file) {
            // Read the OOTRS-only meta file
            if(ootrs && path.endsWith(".meta")){
              promises.push(file.async("text").then(function(text) {
                var lines = text.split("\n");
                lines.forEach((line, i) => {
                  switch(i){
                    case 0: fileData.internalName = line; break;
                    case 2: fileData.type = (line || "bgm").toLowerCase(); break; // <-- By default, songs without this line are bgm
                    case 3: fileData.categories = line; break;
                  }
                });
              }));
            }

            // Read the MMRS-only categories file
            if(!ootrs && path == "categories.txt"){
              promises.push(file.async("text").then(function(text) {
                var categories = text.replaceAll('-', ','); // <-- Normalize separator
                fileData.categories = categories;

                // Detect if the categories are correctly mapped
                var catArray = categories.split(',');
                var isFanfare = catArray.every(cat => {
                  //console.log(`${cat} isFanfare: ${MMCategories.isFanfare(cat)}`);
                  return MMCategories.isFanfare(cat);
                });
                var isBgm = catArray.every(cat => {
                  //console.log(`${cat} isBgm: ${MMCategories.isBgm(cat)}`);
                  return MMCategories.isBgm(cat);
                });

                //console.log(catArray + ' ' + isFanfare + '  ' + isBgm);
                if(isFanfare) fileData.type = "fanfare";
                else if(isBgm) fileData.type = "bgm";
                else {
                  console.log(`isFanfare ${isFanfare} | isBgm ${isBgm}`)
                  // This song has mixed categories! We cannot accept it...
                  if(isFanfare && isBgm) fileData.error = `This file has mixed categories!\nFix the categories.txt file so they has ONLY bgm or ONLY fanfare categories.`;
                  else fileData.error = `This file has corrupt categories, or uses one that doesn't exists!\nFix the categories.txt file by using only valid categories.`;
                  clearFileInput();
                }
              }));
            }

            // Read the universal metadata yaml file
            if(path.endsWith(".metadata")){
              promises.push(file.async("text").then(function(text) {
                var metadataYaml = YAML.parse(text);
                var metadata = metadataYaml["metadata"];
                console.log(metadata);

                fileData.internalName = metadata["display name"];
                fileData.type = metadata["song type"].toLowerCase();
                fileData.categories = metadata["music groups"].join(",");
                usesFormmask = (metadataYaml["formmask"] ?? []).length > 0;
                isLegacyFormat = false;
              }));
            }

            // Extract the sequence file
            if(SeqUtils.isSeqExtension(path)){
              promises.push(file.async("uint8array").then(function(seq){
                  fileData.seq = seq;    
              }));
            }

            // Check custom bank and samples
            if(path.endsWith(".zbank")) fileData.usesCustomBank = true;
            if(path.endsWith(".zsound")) fileData.usesCustomSamples = true;
            if(path.endsWith(".formmask")) fileData.usesFormmask = true;
          });

          await Promise.all(promises);

        } catch(e){
            fileData.error = `Couldn't process the file: ${e}`;
        }


        return fileData;
    }
}