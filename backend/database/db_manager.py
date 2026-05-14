# database/db_manager.py
import os
import json
import threading
from datetime import datetime
import shutil

class DatabaseManager:
    """
    Manages database operations for TuneSift using JSON files.
    """

    def __init__(self, data_dir='data'):
        """
        Initialize the database manager.

        Parameters:
        -----------
        data_dir : str, optional
            Directory to store database files
        """
        self.data_dir = data_dir
        self.collections = {}
        self.locks = {}
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        """Ensure the data directory exists"""
        os.makedirs(self.data_dir, exist_ok=True)

    def _get_collection_path(self, collection_name):
        """Get the path to a collection file"""
        return os.path.join(self.data_dir, f"{collection_name}.json")

    def _load_collection(self, collection_name):
        """Load a collection from disk"""
        path = self._get_collection_path(collection_name)

        if collection_name not in self.locks:
            self.locks[collection_name] = threading.Lock()

        with self.locks[collection_name]:
            if os.path.exists(path):
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        self.collections[collection_name] = data
                except json.JSONDecodeError:
                    # If the file is corrupted, create a backup and start fresh
                    if os.path.getsize(path) > 0:
                        backup_path = f"{path}.bak.{datetime.now().strftime('%Y%m%d%H%M%S')}"
                        shutil.copy2(path, backup_path)
                    self.collections[collection_name] = []
            else:
                self.collections[collection_name] = []

    def _save_collection(self, collection_name):
        """Save a collection to disk"""
        path = self._get_collection_path(collection_name)

        if collection_name not in self.locks:
            self.locks[collection_name] = threading.Lock()

        with self.locks[collection_name]:
            # Create a temporary file first
            temp_path = f"{path}.tmp"
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(self.collections[collection_name], f, ensure_ascii=False, indent=2)

            # Rename the temporary file to the actual file
            os.replace(temp_path, path)

    def get_collection(self, collection_name):
        """
        Get a collection by name.

        Parameters:
        -----------
        collection_name : str
            Name of the collection

        Returns:
        --------
        list
            Collection data
        """
        if collection_name not in self.collections:
            self._load_collection(collection_name)

        return self.collections[collection_name]

    def find_one(self, collection_name, query):
        """
        Find a single document in a collection.

        Parameters:
        -----------
        collection_name : str
            Name of the collection
        query : dict
            Query to match against documents

        Returns:
        --------
        dict or None
            Matching document or None if not found
        """
        collection = self.get_collection(collection_name)

        for item in collection:
            matches = True
            for key, value in query.items():
                if key not in item or item[key] != value:
                    matches = False
                    break

            if matches:
                return item

        return None

    def find(self, collection_name, query=None):
        """
        Find documents in a collection.

        Parameters:
        -----------
        collection_name : str
            Name of the collection
        query : dict, optional
            Query to match against documents

        Returns:
        --------
        list
            List of matching documents
        """
        collection = self.get_collection(collection_name)

        if not query:
            return collection

        results = []
        for item in collection:
            matches = True
            for key, value in query.items():
                if key not in item or item[key] != value:
                    matches = False
                    break

            if matches:
                results.append(item)

        return results

    def insert_one(self, collection_name, document):
        """
        Insert a document into a collection.

        Parameters:
        -----------
        collection_name : str
            Name of the collection
        document : dict
            Document to insert

        Returns:
        --------
        dict
            Inserted document
        """
        collection = self.get_collection(collection_name)
        collection.append(document)
        self._save_collection(collection_name)
        return document

    def insert_many(self, collection_name, documents):
        """
        Insert multiple documents into a collection.

        Parameters:
        -----------
        collection_name : str
            Name of the collection
        documents : list
            Documents to insert

        Returns:
        --------
        list
            Inserted documents
        """
        collection = self.get_collection(collection_name)
        collection.extend(documents)
        self._save_collection(collection_name)
        return documents

    def update_one(self, collection_name, query, update):
        """
        Update a single document in a collection.

        Parameters:
        -----------
        collection_name : str
            Name of the collection
        query : dict
            Query to match against documents
        update : dict
            Update to apply to the document

        Returns:
        --------
        dict or None
            Updated document or None if not found
        """
        collection = self.get_collection(collection_name)

        for i, item in enumerate(collection):
            matches = True
            for key, value in query.items():
                if key not in item or item[key] != value:
                    matches = False
                    break

            if matches:
                for key, value in update.items():
                    item[key] = value
                collection[i] = item
                self._save_collection(collection_name)
                return item

        return None

    def update_many(self, collection_name, query, update):
        """
        Update multiple documents in a collection.

        Parameters:
        -----------
        collection_name : str
            Name of the collection
        query : dict
            Query to match against documents
        update : dict
            Update to apply to the documents

        Returns:
        --------
        int
            Number of documents updated
        """
        collection = self.get_collection(collection_name)
        count = 0

        for i, item in enumerate(collection):
            matches = True
            for key, value in query.items():
                if key not in item or item[key] != value:
                    matches = False
                    break

            if matches:
                for key, value in update.items():
                    item[key] = value
                collection[i] = item
                count += 1

        if count > 0:
            self._save_collection(collection_name)

        return count

    def delete_one(self, collection_name, query):
        """
        Delete a single document from a collection.

        Parameters:
        -----------
        collection_name : str
            Name of the collection
        query : dict
            Query to match against documents

        Returns:
        --------
        bool
            True if a document was deleted, False otherwise
        """
        collection = self.get_collection(collection_name)

        for i, item in enumerate(collection):
            matches = True
            for key, value in query.items():
                if key not in item or item[key] != value:
                    matches = False
                    break

            if matches:
                del collection[i]
                self._save_collection(collection_name)
                return True

        return False

    def delete_many(self, collection_name, query):
        """
        Delete multiple documents from a collection.

        Parameters:
        -----------
        collection_name : str
            Name of the collection
        query : dict
            Query to match against documents

        Returns:
        --------
        int
            Number of documents deleted
        """
        collection = self.get_collection(collection_name)
        original_length = len(collection)

        new_collection = []
        for item in collection:
            matches = True
            for key, value in query.items():
                if key not in item or item[key] != value:
                    matches = False
                    break

            if not matches:
                new_collection.append(item)

        self.collections[collection_name] = new_collection
        self._save_collection(collection_name)

        return original_length - len(new_collection)

    def count(self, collection_name, query=None):
        """
        Count documents in a collection.

        Parameters:
        -----------
        collection_name : str
            Name of the collection
        query : dict, optional
            Query to match against documents

        Returns:
        --------
        int
            Number of matching documents
        """
        if query:
            return len(self.find(collection_name, query))
        else:
            return len(self.get_collection(collection_name))

    def backup(self, backup_dir=None):
        """
        Create a backup of all collections.

        Parameters:
        -----------
        backup_dir : str, optional
            Directory to store backups (default: data_dir/backups)

        Returns:
        --------
        str
            Path to the backup directory
        """
        if backup_dir is None:
            backup_dir = os.path.join(self.data_dir, 'backups')

        # Create backup directory with timestamp
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        backup_path = os.path.join(backup_dir, timestamp)
        os.makedirs(backup_path, exist_ok=True)

        # Save all collections
        for collection_name in self.collections:
            self._save_collection(collection_name)

            # Copy the collection file to the backup directory
            src_path = self._get_collection_path(collection_name)
            dst_path = os.path.join(backup_path, f"{collection_name}.json")

            if os.path.exists(src_path):
                shutil.copy2(src_path, dst_path)

        return backup_path


# Create a singleton instance
db_manager = DatabaseManager()

def get_db():
    """
    Get the database manager instance.

    Returns:
    --------
    DatabaseManager
        Database manager instance
    """
    return db_manager
